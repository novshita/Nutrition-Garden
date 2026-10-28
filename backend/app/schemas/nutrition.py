from typing import Literal

from pydantic import BaseModel, Field


class Micronutrient(BaseModel):
    amount: float
    unit: str


class NutritionPer100g(BaseModel):
    """Internal nutrition model. None means unknown, never zero (spec §23)."""

    calories: float | None = None
    protein_g: float | None = None
    carbohydrate_g: float | None = None
    fat_g: float | None = None
    fiber_g: float | None = None
    micronutrients: dict[str, Micronutrient] = Field(default_factory=dict)


class Portion(BaseModel):
    description: str
    gram_weight: float


class FoodItem(BaseModel):
    fdc_id: int
    name: str
    data_type: str
    brand: str | None = None
    portions: list[Portion] = Field(default_factory=list)
    nutrition_per_100g: NutritionPer100g


class FoodSearchResponse(BaseModel):
    query: str
    page: int
    total_hits: int
    total_pages: int
    results: list[FoodItem]
    # "cache" means USDA could not be reached and results come from previously used foods.
    source: Literal["usda", "cache"]


class FoodDetailResponse(BaseModel):
    food: FoodItem
    source: Literal["usda", "cache"]
    stale: bool = False
