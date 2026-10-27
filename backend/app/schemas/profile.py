from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import MAX_ONBOARDING_AGE, MIN_ONBOARDING_AGE
from app.enums import ActivityLevel, GoalType, Sex, UnitSystem
from app.services.calculations.body import age_in_years


class ProfileCreate(BaseModel):
    """Onboarding input. Values are canonical metric; the frontend converts (spec §4)."""

    date_of_birth: date
    sex: Sex
    height_cm: float = Field(ge=50, le=260)
    weight_kg: float = Field(ge=20, le=400)
    goal_weight_kg: float = Field(ge=20, le=400)
    preferred_unit_system: UnitSystem
    activity_level: ActivityLevel
    timezone: str = Field(min_length=1, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError, OSError):
            raise ValueError("Unknown timezone") from None
        return value

    @field_validator("date_of_birth")
    @classmethod
    def _valid_age(cls, value: date) -> date:
        try:
            age = age_in_years(value, datetime.now(UTC).date())
        except ValueError as exc:
            raise ValueError(str(exc)) from None
        if not MIN_ONBOARDING_AGE <= age <= MAX_ONBOARDING_AGE:
            raise ValueError(f"Age must be between {MIN_ONBOARDING_AGE} and {MAX_ONBOARDING_AGE}")
        return value


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date_of_birth: date
    sex: Sex
    height_cm: float
    preferred_unit_system: UnitSystem
    activity_level: ActivityLevel
    goal_type: GoalType
    goal_weight_kg: float
    timezone: str


class ProfileSummary(BaseModel):
    """Profile plus values derived by the backend (BMI is informational, spec §8)."""

    profile: ProfileResponse
    current_weight_kg: float
    bmi: float
    bmr_kcal: float
    tdee_kcal: float
    calorie_target_kcal: int
