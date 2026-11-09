"""Slows down password guessing (login and password change) without locking anyone out for long."""

import math
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import LOGIN_FAILURE_WINDOW_MINUTES, LOGIN_MAX_FAILURES
from app.models import LoginFailure

_WINDOW = timedelta(minutes=LOGIN_FAILURE_WINDOW_MINUTES)


def login_key(email: str) -> str:
    return f"login:{email.strip().lower()}"[:400]


def password_key(user_id: uuid.UUID) -> str:
    return f"password:{user_id}"


def seconds_until_allowed(db: Session, key: str, now: datetime) -> int:
    """0 if another attempt is allowed, otherwise how long to wait. Also tidies up old failures."""
    db.execute(delete(LoginFailure).where(LoginFailure.attempted_at <= now - _WINDOW))
    recent = db.scalars(
        select(LoginFailure.attempted_at)
        .where(LoginFailure.key == key)
        .order_by(LoginFailure.attempted_at.desc())
        .limit(LOGIN_MAX_FAILURES)
    ).all()
    if len(recent) < LOGIN_MAX_FAILURES:
        return 0
    # Allowed again once the oldest of the failures that fill the limit has aged out.
    return max(1, math.ceil((recent[-1] + _WINDOW - now).total_seconds()))


def record_failure(db: Session, key: str, now: datetime) -> None:
    db.add(LoginFailure(key=key, attempted_at=now))
    db.flush()


def clear(db: Session, key: str) -> None:
    db.execute(delete(LoginFailure).where(LoginFailure.key == key))


def failure_count(db: Session, key: str) -> int:
    return db.scalar(select(func.count()).select_from(LoginFailure).where(LoginFailure.key == key)) or 0


def wait_message(seconds: int) -> str:
    minutes = max(1, math.ceil(seconds / 60))
    unit = "minute" if minutes == 1 else "minutes"
    return f"Too many attempts. Please wait about {minutes} {unit} and try again."
