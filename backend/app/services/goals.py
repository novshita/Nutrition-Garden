"""Calorie target history (engineering spec §13). Targets are closed, never overwritten."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import CalorieTargetSource
from app.models import CalorieTarget, User


def get_current_target(db: Session, user: User) -> CalorieTarget | None:
    return db.scalar(
        select(CalorieTarget).where(
            CalorieTarget.user_id == user.id, CalorieTarget.effective_until.is_(None)
        )
    )


def get_history(db: Session, user: User) -> list[CalorieTarget]:
    return list(
        db.scalars(
            select(CalorieTarget)
            .where(CalorieTarget.user_id == user.id)
            .order_by(CalorieTarget.effective_from.desc())
        )
    )


def set_target(
    db: Session,
    user: User,
    target_kcal: int,
    source: CalorieTargetSource,
    reason: str | None,
) -> CalorieTarget:
    now = datetime.now(UTC)
    current = get_current_target(db, user)
    if current is not None:
        current.effective_until = now
        db.flush()  # close the old row before opening the new one (one open target per user)
    target = CalorieTarget(
        user_id=user.id,
        target_kcal=target_kcal,
        source=source,
        reason=reason,
        effective_from=now,
    )
    db.add(target)
    db.flush()
    return target


def get_target_at(db: Session, user: User, at: datetime) -> CalorieTarget | None:
    """The target that was in effect at `at` (history is never overwritten)."""
    return db.scalar(
        select(CalorieTarget)
        .where(CalorieTarget.user_id == user.id, CalorieTarget.effective_from <= at)
        .order_by(CalorieTarget.effective_from.desc())
        .limit(1)
    )
