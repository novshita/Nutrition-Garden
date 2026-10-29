import uuid
from datetime import UTC, datetime, timedelta
from typing import Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.config import MAX_WORKOUT_SESSION_SECONDS
from app.enums import Difficulty, ExerciseCategory, ExerciseType, Weekday

MAX_REPS = 1000
MAX_EXERCISE_SECONDS = 7200


class ExerciseIn(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=100)
    exercise_type: ExerciseType
    category: ExerciseCategory
    default_sets: int = Field(default=1, ge=1, le=50)
    default_reps: int | None = Field(default=None, ge=1, le=MAX_REPS)
    default_duration_seconds: int | None = Field(default=None, ge=1, le=MAX_EXERCISE_SECONDS)
    rest_seconds: int = Field(default=0, ge=0, le=3600)

    @model_validator(mode="after")
    def _matches_type(self) -> Self:
        needs_reps = self.exercise_type in (ExerciseType.REPS, ExerciseType.COMBINED)
        needs_time = self.exercise_type in (ExerciseType.TIME, ExerciseType.COMBINED)
        if needs_reps != (self.default_reps is not None):
            raise ValueError(
                f"{self.exercise_type.value} exercises "
                f"{'require' if needs_reps else 'cannot have'} default_reps"
            )
        if needs_time != (self.default_duration_seconds is not None):
            raise ValueError(
                f"{self.exercise_type.value} exercises "
                f"{'require' if needs_time else 'cannot have'} default_duration_seconds"
            )
        return self


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    difficulty: Difficulty = Difficulty.CUSTOM
    exercises: list[ExerciseIn] = Field(min_length=1, max_length=50)


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exercise_name: str
    exercise_type: ExerciseType
    category: ExerciseCategory
    order_index: int
    default_sets: int
    default_reps: int | None
    default_duration_seconds: int | None
    rest_seconds: int


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    difficulty: Difficulty
    exercises: list[ExerciseOut]


class ScheduleDayIn(BaseModel):
    weekday: Weekday
    template_id: uuid.UUID | None = None
    is_rest_day: bool = False

    @model_validator(mode="after")
    def _rest_or_template(self) -> Self:
        if self.is_rest_day and self.template_id is not None:
            raise ValueError("A rest day cannot have a workout")
        if not self.is_rest_day and self.template_id is None:
            raise ValueError("Choose a workout, or mark the day as a rest day")
        return self


class ScheduleUpdate(BaseModel):
    """The full weekly plan. Weekdays left out simply have nothing planned."""

    days: list[ScheduleDayIn] = Field(max_length=7)

    @model_validator(mode="after")
    def _unique_days(self) -> Self:
        weekdays = [d.weekday for d in self.days]
        if len(set(weekdays)) != len(weekdays):
            raise ValueError("Each weekday can appear only once")
        return self


class ScheduleDayOut(BaseModel):
    weekday: Weekday
    is_rest_day: bool
    template_id: uuid.UUID | None
    template_name: str | None


class SetIn(BaseModel):
    exercise_id: uuid.UUID
    set_number: int = Field(ge=1, le=100)
    repetitions: int | None = Field(default=None, ge=0, le=MAX_REPS)
    duration_seconds: int | None = Field(default=None, ge=0, le=MAX_EXERCISE_SECONDS)
    completed: bool = True


class SessionCreate(BaseModel):
    template_id: uuid.UUID | None = None
    started_at: AwareDatetime
    completed_at: AwareDatetime
    notes: str | None = Field(default=None, max_length=500)
    sets: list[SetIn] = Field(default_factory=list, max_length=300)

    @model_validator(mode="after")
    def _valid_times_and_sets(self) -> Self:
        if self.completed_at <= self.started_at:
            raise ValueError("completed_at must be after started_at")
        if (self.completed_at - self.started_at).total_seconds() > MAX_WORKOUT_SESSION_SECONDS:
            raise ValueError("A workout cannot be longer than 6 hours")
        if self.completed_at > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("completed_at cannot be in the future")
        keys = [(s.exercise_id, s.set_number) for s in self.sets]
        if len(set(keys)) != len(keys):
            raise ValueError("Each exercise can have a given set number only once")
        return self


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise_id: uuid.UUID | None
    set_number: int
    repetitions: int | None
    duration_seconds: int | None
    completed: bool


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_id: uuid.UUID | None
    template_name: str | None = None  # filled in by the service from the template
    started_at: datetime
    completed_at: datetime | None
    duration_seconds: int
    # An estimate for information only; it never changes the food target.
    estimated_calories: int | None
    notes: str | None
    sets: list[SetOut]
