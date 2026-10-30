"""Daily records follow the user's local timezone; timestamps are stored in UTC (spec §52)."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserProfile


def get_timezone(db: Session, user: User) -> ZoneInfo:
    """User's timezone from their profile; UTC until onboarding is done."""
    name = db.scalar(select(UserProfile.timezone).where(UserProfile.user_id == user.id))
    return ZoneInfo(name or "UTC")


def local_today(db: Session, user: User) -> date:
    return datetime.now(get_timezone(db, user)).date()


def local_day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """[start, end) of a local calendar day."""
    start = datetime.combine(day, datetime.min.time(), tz)
    return start, datetime.combine(day + timedelta(days=1), datetime.min.time(), tz)


def local_date_of(db: Session, user: User, moment: datetime) -> date:
    """The user's local calendar date for a timestamp."""
    return moment.astimezone(get_timezone(db, user)).date()
