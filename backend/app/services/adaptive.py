"""Calorie suggestions from the weight trend. Only a user-confirmed accept changes a target."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import CalorieTargetSource, SuggestionStatus
from app.models import CalorieTarget, User, WeightLog
from app.schemas.goals import CalorieSuggestionOut
from app.services import goals
from app.services.calculations import adaptive, weight_trend
from app.services.errors import ConflictError
from app.services.timezone import get_timezone


class NoTargetError(Exception):
    """The user hasn't completed onboarding, so there is no target to review."""


def get_suggestion(db: Session, user: User) -> CalorieSuggestionOut:
    current = goals.get_current_target(db, user)
    if current is None:
        raise NoTargetError
    tz = get_timezone(db, user)
    today = datetime.now(tz).date()
    rows = db.execute(
        select(WeightLog.recorded_at, WeightLog.weight_kg).where(WeightLog.user_id == user.id)
    ).all()
    daily = weight_trend.daily_means([(r.recorded_at, float(r.weight_kg)) for r in rows], tz)

    evaluation = adaptive.evaluate(daily, today, current.effective_from.astimezone(tz).date())
    suggestion = adaptive.suggest(evaluation, current.target_kcal)
    return CalorieSuggestionOut(
        status=suggestion.status,
        reason=suggestion.reason,
        trend_state=evaluation.trend_state,
        weekly_change_kg=(
            None if evaluation.weekly_change_kg is None else round(evaluation.weekly_change_kg, 2)
        ),
        evaluated_from=evaluation.period_start,
        evaluated_to=evaluation.period_end,
        weigh_in_days=evaluation.weigh_in_days,
        current_target_kcal=current.target_kcal,
        suggested_target_kcal=suggestion.suggested_target_kcal,
        days_until_evaluation=evaluation.days_until_ready,
    )


def accept_suggestion(db: Session, user: User, target_kcal: int) -> CalorieTarget:
    """Apply the suggestion the user is looking at. Refuses if it isn't the current suggestion."""
    suggestion = get_suggestion(db, user)
    if (
        suggestion.status != SuggestionStatus.REVIEW_SUGGESTED
        or suggestion.suggested_target_kcal is None
        or suggestion.suggested_target_kcal != target_kcal
    ):
        raise ConflictError("There is no matching suggestion to accept")
    return goals.set_target(
        db,
        user,
        target_kcal,
        CalorieTargetSource.ACCEPTED_SUGGESTION,
        f"Accepted suggestion: {suggestion.reason.value}",
    )
