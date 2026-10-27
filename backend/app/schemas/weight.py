import uuid
from datetime import UTC, date, datetime, timedelta

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.enums import TrendState


class WeightCreate(BaseModel):
    weight_kg: float = Field(gt=0, le=400, allow_inf_nan=False)
    recorded_at: AwareDatetime | None = None
    note: str | None = Field(default=None, max_length=500)

    @field_validator("recorded_at")
    @classmethod
    def _not_in_future(cls, value: datetime | None) -> datetime | None:
        if value is not None and value > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("recorded_at cannot be in the future")
        return value


class WeightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recorded_at: datetime
    weight_kg: float
    note: str | None


class RollingPoint(BaseModel):
    date: date
    average_kg: float


class TrendResponse(BaseModel):
    state: TrendState
    current_average_kg: float | None
    previous_average_kg: float | None
    weekly_change_kg: float | None
    days_with_data: int
    series: list[RollingPoint]


class BmiResponse(BaseModel):
    """Informational only; not a diagnosis (product spec §8)."""

    bmi: float
    weight_kg: float
    height_cm: float
