from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserProfile, WeightLog
from app.schemas.weight import RollingPoint, TrendResponse
from app.services.calculations import weight_trend


def get_timezone(db: Session, user: User) -> ZoneInfo:
    """User's timezone from their profile; UTC until onboarding is done (spec §52)."""
    name = db.scalar(select(UserProfile.timezone).where(UserProfile.user_id == user.id))
    return ZoneInfo(name or "UTC")


def add_weight(
    db: Session, user: User, weight_kg: float, recorded_at: datetime | None, note: str | None
) -> WeightLog:
    log = WeightLog(
        user_id=user.id,
        recorded_at=(recorded_at or datetime.now(UTC)).astimezone(UTC),
        weight_kg=weight_kg,
        note=note,
    )
    db.add(log)
    db.flush()
    return log


def get_latest(db: Session, user: User) -> WeightLog | None:
    return db.scalar(
        select(WeightLog)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.desc())
        .limit(1)
    )


def list_weights(
    db: Session,
    user: User,
    start_date: date | None,
    end_date: date | None,
    limit: int,
) -> list[WeightLog]:
    """Oldest first, for graphing. Dates are local days in the user's timezone."""
    tz = get_timezone(db, user)
    query = select(WeightLog).where(WeightLog.user_id == user.id)
    if start_date is not None:
        query = query.where(WeightLog.recorded_at >= datetime.combine(start_date, datetime.min.time(), tz))
    if end_date is not None:
        end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tz)
        query = query.where(WeightLog.recorded_at < end)
    return list(db.scalars(query.order_by(WeightLog.recorded_at.asc()).limit(limit)))


def get_trend(db: Session, user: User, series_days: int) -> TrendResponse:
    tz = get_timezone(db, user)
    rows = db.execute(
        select(WeightLog.recorded_at, WeightLog.weight_kg).where(WeightLog.user_id == user.id)
    ).all()
    daily = weight_trend.daily_means([(r.recorded_at, float(r.weight_kg)) for r in rows], tz)
    today = datetime.now(tz).date()
    result = weight_trend.compute_trend(daily, today)
    cutoff = today - timedelta(days=series_days)
    series = [
        RollingPoint(date=day, average_kg=round(avg, 2))
        for day, avg in weight_trend.rolling_average_series(daily)
        if day >= cutoff
    ]
    return TrendResponse(
        state=result.state,
        current_average_kg=_round(result.current_average_kg),
        previous_average_kg=_round(result.previous_average_kg),
        weekly_change_kg=_round(result.weekly_change_kg),
        days_with_data=result.days_with_data,
        series=series,
    )


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 2)
