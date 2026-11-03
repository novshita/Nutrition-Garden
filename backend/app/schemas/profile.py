from datetime import UTC, date, datetime
from typing import Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.config import MAX_ONBOARDING_AGE, MIN_ONBOARDING_AGE
from app.enums import ActivityLevel, GoalType, Sex, UnitSystem
from app.services.calculations.body import age_in_years


def check_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise ValueError("Unknown timezone") from None
    return value


def check_birth_date(value: date) -> date:
    try:
        age = age_in_years(value, datetime.now(UTC).date())
    except ValueError as exc:
        raise ValueError(str(exc)) from None
    if not MIN_ONBOARDING_AGE <= age <= MAX_ONBOARDING_AGE:
        raise ValueError(f"Age must be between {MIN_ONBOARDING_AGE} and {MAX_ONBOARDING_AGE}")
    return value


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

    _timezone = field_validator("timezone")(check_timezone)
    _birth_date = field_validator("date_of_birth")(check_birth_date)


class ProfileUpdate(BaseModel):
    """Change some profile details. Only the fields sent are changed; the rest stay as they are.

    Current weight isn't here (it's a weigh-in), and neither is anything the person can't choose, such
    as the goal type. Unknown fields are refused rather than silently ignored.
    """

    model_config = ConfigDict(extra="forbid")

    date_of_birth: date | None = None
    sex: Sex | None = None
    height_cm: float | None = Field(default=None, ge=50, le=260)
    goal_weight_kg: float | None = Field(default=None, ge=20, le=400)
    preferred_unit_system: UnitSystem | None = None
    activity_level: ActivityLevel | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def _only_real_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Send at least one detail to change")
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} can't be empty")
        if self.timezone is not None:
            check_timezone(self.timezone)
        if self.date_of_birth is not None:
            check_birth_date(self.date_of_birth)
        return self


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
