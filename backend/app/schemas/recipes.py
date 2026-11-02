import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.config import (
    MAX_RECIPE_LOG_SERVINGS,
    RECIPE_MAX_SERVING_CALORIES,
    RECIPE_MAX_SERVING_NUTRIENT_G,
    RECIPE_MAX_SERVINGS_MADE,
)
from app.enums import MealType

MAX_LINES = 50
MAX_ALTERNATIVES = 10
MAX_LINE_LENGTH = 200


def _clean_lines(limit: int):
    def check(values: list[str]) -> list[str]:
        cleaned = [v.strip() for v in values if v.strip()]
        if len(cleaned) > limit:
            raise ValueError(f"At most {limit} entries are allowed")
        if any(len(v) > MAX_LINE_LENGTH for v in cleaned):
            raise ValueError(f"Each entry must be {MAX_LINE_LENGTH} characters or fewer")
        return cleaned

    return AfterValidator(check)


Nutrient = Annotated[float | None, Field(default=None, ge=0, le=RECIPE_MAX_SERVING_NUTRIENT_G, allow_inf_nan=False)]


class RecipeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    servings: int = Field(default=1, ge=1, le=RECIPE_MAX_SERVINGS_MADE)
    serving_size: str | None = Field(default=None, max_length=100)
    # Approximate, per serving. Blank means unknown, which is not the same as zero.
    calories: float | None = Field(default=None, ge=0, le=RECIPE_MAX_SERVING_CALORIES, allow_inf_nan=False)
    protein_g: Nutrient
    carbohydrate_g: Nutrient
    fat_g: Nutrient
    fiber_g: Nutrient
    ingredients: Annotated[list[str], _clean_lines(MAX_LINES)] = Field(default_factory=list)
    alternatives: Annotated[list[str], _clean_lines(MAX_ALTERNATIVES)] = Field(default_factory=list)
    instructions: str | None = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The recipe needs a name")
        return value

    @field_validator("description", "serving_size", "instructions")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None


class RecipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    servings: int
    serving_size: str | None
    calories: float | None
    protein_g: float | None
    carbohydrate_g: float | None
    fat_g: float | None
    fiber_g: float | None
    ingredients: list[str]
    alternatives: list[str]
    instructions: str | None


class RecipeLogRequest(BaseModel):
    servings: float = Field(gt=0, le=MAX_RECIPE_LOG_SERVINGS, allow_inf_nan=False)
    meal_type: MealType
    consumed_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _not_in_future(self) -> Self:
        if self.consumed_at and self.consumed_at > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("consumed_at cannot be in the future")
        return self
