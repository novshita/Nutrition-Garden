from datetime import date

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.food_log import DailyNutrition
from app.services import goals
from app.services.nutrition import food_logging
from app.services.timezone import get_timezone, local_day_bounds, local_today

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


@router.get("/daily", response_model=DailyNutrition)
def daily_nutrition(user: CurrentUser, db: DbSession, day: date | None = None) -> DailyNutrition:
    """Backend-calculated totals for a local day, with the calorie target in effect then."""
    day = day or local_today(db, user)
    totals = food_logging.daily_totals(food_logging.list_logs_for_day(db, user, day))
    _, day_end = local_day_bounds(day, get_timezone(db, user))
    target = goals.get_target_at(db, user, day_end)
    remaining = None
    if target is not None and totals.calories is not None:
        remaining = round(max(target.target_kcal - totals.calories, 0), 2)
    elif target is not None:
        remaining = float(target.target_kcal)
    return DailyNutrition(
        date=day,
        totals=food_logging.totals_out(totals),
        calorie_target_kcal=target.target_kcal if target else None,
        calories_remaining=remaining,
    )
