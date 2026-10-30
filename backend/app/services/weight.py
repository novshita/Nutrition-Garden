import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.enums import GrowthAction
from app.models import User, WeightLog
from app.schemas.weight import RollingPoint, TrendResponse
from app.services.calculations import weight_trend
from app.services.errors import ConflictError, NotFoundError
from app.services.garden import garden as garden_service
from app.services.timezone import get_timezone, local_date_of


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
    garden_service.record(
        db, user, GrowthAction.WEIGHT_LOGGED, local_date_of(db, user, log.recorded_at)
    )
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


def delete_weight(db: Session, user: User, entry_id: uuid.UUID) -> None:
    log = db.scalar(select(WeightLog).where(WeightLog.id == entry_id, WeightLog.user_id == user.id))
    if log is None:
        raise NotFoundError
    count = db.scalar(select(func.count(WeightLog.id)).where(WeightLog.user_id == user.id))
    if count <= 1:
        # BMI, BMR and the calorie target all need a current weight.
        raise ConflictError("At least one weight entry is required")
    db.delete(log)
    db.flush()
