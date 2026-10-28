import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.config import (
    MAX_SLEEP_MINUTES,
    MAX_STEPS_PER_DAY,
    MAX_WATER_ENTRY_ML,
    SLEEP_QUALITY_MAX,
    SLEEP_QUALITY_MIN,
)
from app.enums import Mood
from app.services.calculations.sleep import duration_minutes


class WaterCreate(BaseModel):
    amount_ml: int = Field(ge=0, le=MAX_WATER_ENTRY_ML)
    consumed_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _not_in_future(self) -> Self:
        if self.consumed_at and self.consumed_at > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("consumed_at cannot be in the future")
        return self


class WaterEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    consumed_at: datetime
    amount_ml: int


class WaterDay(BaseModel):
    date: date
    total_ml: int
    entries: list[WaterEntry]


class StepsUpdate(BaseModel):
    steps: int = Field(ge=0, le=MAX_STEPS_PER_DAY)


class StepsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    steps: int


class MoodUpdate(BaseModel):
    mood: Mood
    note: str | None = Field(default=None, max_length=500)


class MoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    mood: Mood
    note: str | None


class SleepUpdate(BaseModel):
    """Give bedtime and wake_time (duration is calculated), or duration_minutes alone."""

    bedtime: AwareDatetime | None = None
    wake_time: AwareDatetime | None = None
    duration_minutes: int | None = Field(default=None, gt=0, le=MAX_SLEEP_MINUTES)
    quality: int | None = Field(default=None, ge=SLEEP_QUALITY_MIN, le=SLEEP_QUALITY_MAX)
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _resolve_duration(self) -> Self:
        if (self.bedtime is None) != (self.wake_time is None):
            raise ValueError("Provide both bedtime and wake_time, or neither")
        if self.bedtime and self.wake_time:
            self.duration_minutes = duration_minutes(self.bedtime, self.wake_time)
        elif self.duration_minutes is None:
            raise ValueError("Provide bedtime and wake_time, or duration_minutes")
        return self


class SleepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sleep_date: date
    bedtime: datetime | None
    wake_time: datetime | None
    duration_minutes: int
    quality: int | None
    notes: str | None
