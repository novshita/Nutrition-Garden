"""Shared helpers for the one-row-per-day endpoints."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.services import daily
from app.services.timezone import local_today


def ensure_not_future(db: Session, user: User, day: date) -> None:
    try:
        daily.check_not_future(local_today(db, user), day)
    except daily.FutureDateError as exc:
        raise HTTPException(422, str(exc)) from None


def or_404(row, what: str):
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No {what} recorded for that date")
    return row
