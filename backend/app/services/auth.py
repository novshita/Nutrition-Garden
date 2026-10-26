"""Password hashing and server-side sessions (engineering spec §50)."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import SESSION_LIFETIME_DAYS, get_settings
from app.models import AuthSession, User

_hasher = PasswordHasher()
# Verified against when the email is unknown so login timing doesn't reveal valid emails.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def _hash_token(token: str) -> str:
    key = get_settings().auth_secret.encode()
    return hmac.new(key, token.encode(), hashlib.sha256).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None:
        verify_password(_DUMMY_HASH, password)
        return None
    return user if verify_password(user.password_hash, password) else None


def create_session(db: Session, user: User) -> tuple[str, AuthSession]:
    """Return (raw cookie token, stored session). The raw token is never persisted."""
    token = secrets.token_urlsafe(32)
    session = AuthSession(
        user_id=user.id,
        token_hash=_hash_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=SESSION_LIFETIME_DAYS),
    )
    db.add(session)
    db.flush()
    return token, session


def get_user_for_token(db: Session, token: str) -> User | None:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
    if session is None:
        return None
    if session.expires_at <= datetime.now(UTC):
        db.delete(session)
        db.flush()
        return None
    return db.get(User, session.user_id)


def delete_session(db: Session, token: str) -> None:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
    if session is not None:
        db.delete(session)
        db.flush()
