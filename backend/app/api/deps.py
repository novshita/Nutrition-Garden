from datetime import UTC, datetime
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import SESSION_COOKIE_NAME
from app.db.session import get_db
from app.models import User
from app.services import auth as auth_service

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> User:
    """Ownership always derives from this dependency, never from client-supplied ids (§51)."""
    user = auth_service.get_user_for_token(db, token) if token else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_now() -> datetime:
    """The current moment; a dependency so time-of-day rules can be tested."""
    return datetime.now(UTC)
