"""Water, steps, sleep and mood. One row per local day for all but water."""

from datetime import UTC, date, datetime
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailyActivity, MoodLog, SleepLog, User, WaterLog
from app.schemas.daily import MoodUpdate, SleepUpdate, WaterDay
from app.services.timezone import get_timezone, local_day_bounds

T = TypeVar("T")


class FutureDateError(ValueError):
    pass


def check_not_future(today: date, day: date) -> None:
    if day > today:
        raise FutureDateError("Date cannot be in the future")


def _get_by_date(db: Session, model: type[T], column, user: User, day: date) -> T | None:
    return db.scalar(select(model).where(model.user_id == user.id, column == day))


def _list_by_range(db, model, column, user, start: date | None, end: date | None, limit: int):
    query = select(model).where(model.user_id == user.id)
    if start is not None:
        query = query.where(column >= start)
    if end is not None:
        query = query.where(column <= end)
    return list(db.scalars(query.order_by(column.asc()).limit(limit)))


# Water ---------------------------------------------------------------------------------


def add_water(db: Session, user: User, amount_ml: int, consumed_at: datetime | None) -> WaterLog:
    log = WaterLog(
        user_id=user.id,
        amount_ml=amount_ml,
        consumed_at=(consumed_at or datetime.now(UTC)).astimezone(UTC),
    )
    db.add(log)
    db.flush()
    return log


def get_water_day(db: Session, user: User, day: date) -> WaterDay:
    start, end = local_day_bounds(day, get_timezone(db, user))
    entries = list(
        db.scalars(
            select(WaterLog)
            .where(
                WaterLog.user_id == user.id,
                WaterLog.consumed_at >= start,
                WaterLog.consumed_at < end,
            )
            .order_by(WaterLog.consumed_at.asc())
        )
    )
    return WaterDay(date=day, total_ml=sum(e.amount_ml for e in entries), entries=entries)


# Steps ---------------------------------------------------------------------------------


def set_steps(db: Session, user: User, day: date, steps: int) -> DailyActivity:
    row = _get_by_date(db, DailyActivity, DailyActivity.date, user, day)
    if row is None:
        row = DailyActivity(user_id=user.id, date=day, steps=steps)
        db.add(row)
    else:
        row.steps = steps
    db.flush()
    return row


def get_steps(db: Session, user: User, day: date) -> DailyActivity | None:
    return _get_by_date(db, DailyActivity, DailyActivity.date, user, day)


def list_steps(db, user, start, end, limit) -> list[DailyActivity]:
    return _list_by_range(db, DailyActivity, DailyActivity.date, user, start, end, limit)


# Mood ----------------------------------------------------------------------------------


def set_mood(db: Session, user: User, day: date, data: MoodUpdate) -> MoodLog:
    row = _get_by_date(db, MoodLog, MoodLog.date, user, day)
    if row is None:
        row = MoodLog(user_id=user.id, date=day, mood=data.mood, note=data.note)
        db.add(row)
    else:
        row.mood, row.note = data.mood, data.note
    db.flush()
    return row


def get_mood(db: Session, user: User, day: date) -> MoodLog | None:
    return _get_by_date(db, MoodLog, MoodLog.date, user, day)


def list_mood(db, user, start, end, limit) -> list[MoodLog]:
    return _list_by_range(db, MoodLog, MoodLog.date, user, start, end, limit)


# Sleep ---------------------------------------------------------------------------------


def set_sleep(db: Session, user: User, day: date, data: SleepUpdate) -> SleepLog:
    row = _get_by_date(db, SleepLog, SleepLog.sleep_date, user, day)
    if row is None:
        row = SleepLog(user_id=user.id, sleep_date=day)
        db.add(row)
    row.bedtime = data.bedtime.astimezone(UTC) if data.bedtime else None
    row.wake_time = data.wake_time.astimezone(UTC) if data.wake_time else None
    row.duration_minutes = data.duration_minutes
    row.quality = data.quality
    row.notes = data.notes
    db.flush()
    return row


def get_sleep(db: Session, user: User, day: date) -> SleepLog | None:
    return _get_by_date(db, SleepLog, SleepLog.sleep_date, user, day)


def list_sleep(db, user, start, end, limit) -> list[SleepLog]:
    return _list_by_range(db, SleepLog, SleepLog.sleep_date, user, start, end, limit)
