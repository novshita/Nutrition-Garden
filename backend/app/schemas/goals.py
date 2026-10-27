from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.config import MAX_CALORIE_TARGET_KCAL, MIN_CALORIE_TARGET_KCAL
from app.enums import CalorieTargetSource


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
