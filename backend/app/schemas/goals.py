from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.config import MAX_CALORIE_TARGET_KCAL, MIN_CALORIE_TARGET_KCAL
from app.enums import CalorieTargetSource, SuggestionReason, SuggestionStatus, TrendState


class CalorieTargetUpdate(BaseModel):
    target_kcal: int = Field(ge=MIN_CALORIE_TARGET_KCAL, le=MAX_CALORIE_TARGET_KCAL)
    reason: str | None = Field(default=None, max_length=500)


class CalorieTargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_kcal: int
    source: CalorieTargetSource
    reason: str | None
    effective_from: datetime
    effective_until: datetime | None


class CalorieTargetHistory(BaseModel):
    current: CalorieTargetResponse | None
    history: list[CalorieTargetResponse]


class CalorieSuggestionOut(BaseModel):
    """A suggestion to review the calorie target. It is never applied without the user."""

    status: SuggestionStatus
    reason: SuggestionReason | None
    trend_state: TrendState
    weekly_change_kg: float | None
    evaluated_from: date
    evaluated_to: date
    weigh_in_days: int
    current_target_kcal: int
    suggested_target_kcal: int | None
    # When more time since the last target change is the only thing missing.
    days_until_evaluation: int | None


class AcceptSuggestion(BaseModel):
    """The target the user saw and agreed to; it must match the current suggestion."""

    target_kcal: int
