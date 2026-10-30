"""Calendar: one compact row per day, aggregated from the trackers with a handful of queries."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import Weekday
from app.models import FoodLog, User, WaterLog, WeightLog, WorkoutSession
from app.schemas.dashboard import CalendarDay, CalendarPlanned
from app.services import daily
from app.services.calculations.nutrition import sum_known
from app.services.timezone import get_timezone, local_day_bounds
from app.services.workouts import workouts as workout_service

MAX_RANGE_DAYS = 62
WEEKDAYS = list(Weekday)


class InvalidRangeError(ValueError):
    pass


def build_calendar(db: Session, user: User, start: date, end: date) -> list[CalendarDay]:
    if end < start:
        raise InvalidRangeError("end_date must not be before start_date")
    days = (end - start).days + 1
    if days > MAX_RANGE_DAYS:
        raise InvalidRangeError(f"The range can cover at most {MAX_RANGE_DAYS} days")

    tz = get_timezone(db, user)
    lo, hi = local_day_bounds(start, tz)[0], local_day_bounds(end, tz)[1]

    def local(moment) -> date:
        return moment.astimezone(tz).date()

    water: dict[date, int] = defaultdict(int)
    for row in db.execute(
        select(WaterLog.consumed_at, WaterLog.amount_ml).where(
            WaterLog.user_id == user.id, WaterLog.consumed_at >= lo, WaterLog.consumed_at < hi
        )
    ):
        water[local(row.consumed_at)] += row.amount_ml

    weights: dict[date, float] = {}
    for row in db.execute(
        select(WeightLog.recorded_at, WeightLog.weight_kg)
        .where(WeightLog.user_id == user.id, WeightLog.recorded_at >= lo, WeightLog.recorded_at < hi)
        .order_by(WeightLog.recorded_at.asc())
    ):
        weights[local(row.recorded_at)] = float(row.weight_kg)  # the last one of the day wins

    sessions: dict[date, int] = defaultdict(int)
    for moment in db.scalars(
        select(WorkoutSession.started_at).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.started_at >= lo,
            WorkoutSession.started_at < hi,
        )
    ):
        sessions[local(moment)] += 1

    food: dict[date, list] = defaultdict(list)
    for log in db.scalars(
        select(FoodLog).where(
            FoodLog.user_id == user.id, FoodLog.consumed_at >= lo, FoodLog.consumed_at < hi
        )
    ):
        food[local(log.consumed_at)].extend(log.items)

    sleep = {r.sleep_date: r.duration_minutes for r in daily.list_sleep(db, user, start, end, days)}
    steps = {r.date: r.steps for r in daily.list_steps(db, user, start, end, days)}
    moods = {r.date: r.mood for r in daily.list_mood(db, user, start, end, days)}
    schedule = {d.weekday: d for d in workout_service.get_schedule(db, user)}

    result = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        items = food.get(day, [])
        planned = schedule.get(WEEKDAYS[day.weekday()])
        row = CalendarDay(
            date=day,
            planned_workout=(
                CalendarPlanned(is_rest_day=planned.is_rest_day, template_name=planned.template_name)
                if planned
                else None
            ),
            workouts_completed=sessions.get(day, 0),
            calories=sum_known(i.calories for i in items),
            food_items_logged=len(items),
            weight_kg=weights.get(day),
            water_ml=water.get(day, 0),
            sleep_minutes=sleep.get(day),
            mood=moods.get(day),
            steps=steps.get(day),
            has_activity=False,
        )
        row.has_activity = bool(
            row.workouts_completed
            or row.food_items_logged
            or row.weight_kg is not None
            or row.water_ml
            or row.sleep_minutes is not None
            or row.mood is not None
            or row.steps is not None
        )
        result.append(row)
    return result
