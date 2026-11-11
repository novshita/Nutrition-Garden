from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession, get_now
from app.config import (
    PASSWORD_RESET_LIFETIME_MINUTES,
    SESSION_COOKIE_NAME,
    SESSION_LIFETIME_DAYS,
    get_settings,
)
from app.models import User
from app.schemas.auth import (
    AccountDelete,
    DisplayNameUpdate,
    ForgotPassword,
    LoginRequest,
    PasswordChange,
    RegisterRequest,
    ResetPassword,
    UserResponse,
)
from app.services import auth as auth_service
from app.services import mailer, throttle

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_secure() -> bool:
    settings = get_settings()
    if settings.cookie_secure is not None:
        return settings.cookie_secure
    return settings.app_env == "production"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, response: Response, db: DbSession) -> User:
    user = User(
        email=auth_service.normalize_email(body.email),
        display_name=body.display_name.strip(),
        password_hash=auth_service.hash_password(body.password),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered") from None
    token, _ = auth_service.create_session(db, user)
    db.commit()
    _set_session_cookie(response, token)
    return user


def _refuse_if_throttled(db: DbSession, key: str, now: datetime) -> None:
    wait = throttle.seconds_until_allowed(db, key, now)
    if wait:
        db.commit()  # keeps the tidy-up of old failures
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            throttle.wait_message(wait),
            headers={"Retry-After": str(wait)},
        )


@router.post("/login", response_model=UserResponse)
def login(
    body: LoginRequest,
    response: Response,
    db: DbSession,
    now: Annotated[datetime, Depends(get_now)],
) -> User:
    key = throttle.login_key(body.email)
    _refuse_if_throttled(db, key, now)
    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        throttle.record_failure(db, key, now)
        db.commit()  # the failure must survive the error response
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    throttle.clear(db, key)
    token, _ = auth_service.create_session(db, user)
    db.commit()
    _set_session_cookie(response, token)
    return user


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    body: ForgotPassword,
    db: DbSession,
    background: BackgroundTasks,
    now: Annotated[datetime, Depends(get_now)],
) -> dict[str, str]:
    """Always answers the same way, so it can't be used to find out which emails have accounts."""
    user = auth_service.get_user_by_email(db, body.email)
    if user is not None:
        token = auth_service.start_password_reset(db, user, now)
        db.commit()
        if token is not None:
            link = f"{get_settings().app_base_url.rstrip('/')}/reset-password?token={token}"
            background.add_task(
                mailer.send_email,
                user.email,
                "Reset your Nutrition Garden password",
                "Hi,\n\nUse this link to choose a new password. It works once and expires in "
                f"{PASSWORD_RESET_LIFETIME_MINUTES} minutes:\n\n{link}\n\n"
                "If you didn't ask for this, you can ignore this email; your password hasn't changed.",
            )
    return {"detail": "If that email has an account, a reset link is on its way."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    body: ResetPassword, db: DbSession, now: Annotated[datetime, Depends(get_now)]
) -> None:
    if not auth_service.finish_password_reset(db, body.token, body.new_password, now):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This reset link isn't valid any more. Please ask for a new one.",
        )
    db.commit()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> None:
    if token:
        auth_service.delete_session(db, token)
        db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(body: DisplayNameUpdate, user: CurrentUser, db: DbSession) -> User:
    user.display_name = body.display_name
    db.commit()
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    user: CurrentUser,
    db: DbSession,
    now: Annotated[datetime, Depends(get_now)],
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> None:
    key = throttle.password_key(user.id)
    _refuse_if_throttled(db, key, now)
    # 400, not 401: the person is signed in; only the password they typed is wrong.
    if not auth_service.verify_password(user.password_hash, body.current_password):
        throttle.record_failure(db, key, now)
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password isn't right.")
    if body.new_password == body.current_password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Please choose a password that's different from your current one."
        )
    user.password_hash = auth_service.hash_password(body.new_password)
    auth_service.delete_other_sessions(db, user, token)
    throttle.clear(db, key)
    db.commit()


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: AccountDelete,
    response: Response,
    user: CurrentUser,
    db: DbSession,
    now: Annotated[datetime, Depends(get_now)],
) -> None:
    """Permanently erase the account and all its data. Needs the password, and cannot be undone."""
    key = throttle.password_key(user.id)
    _refuse_if_throttled(db, key, now)
    if not auth_service.verify_password(user.password_hash, body.password):
        throttle.record_failure(db, key, now)
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That password isn't right.")
    throttle.clear(db, key)
    throttle.clear(db, throttle.login_key(user.email))
    auth_service.delete_account(db, user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)
