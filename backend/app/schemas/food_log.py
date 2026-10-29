import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, Field, model_validator

from app.enums import FoodSource, LogSource, MealType
from app.schemas.nutrition import Micronutrient

_NUTRIENT_MAX = 5000.0


class UsdaItemIn(BaseModel):
    """A USDA food. The backend looks it up and calculates the nutrition for the amount."""

    food_source: Literal["USDA"]
    fdc_id: int = Field(gt=0)
    quantity: float = Field(gt=0, le=100_000, allow_inf_nan=False)
    # "g", or one of the food's portion descriptions (e.g. "1 cup").
    unit: str = Field(min_length=1, max_length=100)


class CustomItemIn(BaseModel):
    """A manually entered food. Values are totals for the quantity eaten; omitted means unknown."""

    food_source: Literal["CUSTOM"]
    food_name: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0, le=100_000, allow_inf_nan=False)
    unit: str = Field(min_length=1, max_length=50)
    calories: float = Field(ge=0, le=20_000, allow_inf_nan=False)
    protein_g: float | None = Field(default=None, ge=0, le=_NUTRIENT_MAX, allow_inf_nan=False)
    carbohydrate_g: float | None = Field(default=None, ge=0, le=_NUTRIENT_MAX, allow_inf_nan=False)
    fat_g: float | None = Field(default=None, ge=0, le=_NUTRIENT_MAX, allow_inf_nan=False)
    fiber_g: float | None = Field(default=None, ge=0, le=_NUTRIENT_MAX, allow_inf_nan=False)


FoodItemIn = Annotated[UsdaItemIn | CustomItemIn, Field(discriminator="food_source")]


class FoodLogCreate(BaseModel):
    consumed_at: AwareDatetime | None = None
    meal_type: MealType
    notes: str | None = Field(default=None, max_length=500)
    items: list[FoodItemIn] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def _not_in_future(self) -> Self:
        if self.consumed_at and self.consumed_at > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("consumed_at cannot be in the future")
        return self


class FoodLogItemOut(BaseModel):
    id: uuid.UUID
    food_source: FoodSource
    external_food_id: str | None
    food_name: str
    quantity: float
    unit: str
    serving_size: float | None
    calories: float | None
    protein_g: float | None
    carbohydrate_g: float | None
    fat_g: float | None
    fiber_g: float | None
    micronutrients: dict[str, Micronutrient]
    confidence: float | None


class NutritionTotalsOut(BaseModel):
    calories: float | None
    protein_g: float | None
    carbohydrate_g: float | None
    fat_g: float | None
    fiber_g: float | None
    items_logged: int
    items_missing: dict[str, int]


class FoodLogOut(BaseModel):
    id: uuid.UUID
    consumed_at: datetime
    meal_type: MealType
    source: LogSource
    notes: str | None
    items: list[FoodLogItemOut]
    totals: NutritionTotalsOut


class FoodLogDay(BaseModel):
    date: date
    logs: list[FoodLogOut]


class DailyNutrition(BaseModel):
    date: date
    totals: NutritionTotalsOut
    calorie_target_kcal: int | None
    # Never negative: going over the target is not an error state (product spec §32).
    calories_remaining: float | None
