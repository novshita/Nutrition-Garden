import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.enums import GrowthAction, MilestoneType


class GardenOut(BaseModel):
    id: uuid.UUID
    name: str
    growth_points: int
    growth_stage: int
    bunny_stage: int  # the bunny evolves with the garden stage (spec §40)
    next_stage_at_points: int | None
    points_to_next_stage: int | None
    today_actions: list[GrowthAction]


class ItemPosition(BaseModel):
    x: float
    y: float


class GardenItemOut(BaseModel):
    id: uuid.UUID
    item_type: str
    item_key: str
    placed: bool
    position: ItemPosition | None
    rotation: float | None
    unlocked_at: datetime


class PlaceItem(BaseModel):
    """Position on the garden canvas, normalised so 0..1 covers the whole garden."""

    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)
    rotation: float = Field(default=0, ge=-360, le=360, allow_inf_nan=False)


class MilestoneOut(BaseModel):
    milestone_type: MilestoneType
    trigger_value: int
    unlocked_at: datetime
