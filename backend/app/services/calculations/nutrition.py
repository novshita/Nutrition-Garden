"""Nutrition scaling and totals (engineering spec §22–23). Unknown (None) is never zero."""

from collections.abc import Iterable
from dataclasses import dataclass

from app.schemas.nutrition import Micronutrient, NutritionPer100g

NUTRIENTS = ("calories", "protein_g", "carbohydrate_g", "fat_g", "fiber_g")


@dataclass(frozen=True)
class ScaledNutrition:
    calories: float | None
    protein_g: float | None
    carbohydrate_g: float | None
    fat_g: float | None
    fiber_g: float | None
    micronutrients: dict[str, Micronutrient]


def _scale(value: float | None, factor: float) -> float | None:
    return None if value is None else round(value * factor, 2)


def scale_nutrition(per_100g: NutritionPer100g, grams: float) -> ScaledNutrition:
    if grams <= 0:
        raise ValueError("grams must be greater than zero")
    factor = grams / 100
    return ScaledNutrition(
        calories=_scale(per_100g.calories, factor),
        protein_g=_scale(per_100g.protein_g, factor),
        carbohydrate_g=_scale(per_100g.carbohydrate_g, factor),
        fat_g=_scale(per_100g.fat_g, factor),
        fiber_g=_scale(per_100g.fiber_g, factor),
        micronutrients={
            key: Micronutrient(amount=round(m.amount * factor, 3), unit=m.unit)
            for key, m in per_100g.micronutrients.items()
        },
    )


def sum_known(values: Iterable[float | None]) -> float | None:
    """Sum of the known values; None if none are known (so "no data" is not shown as 0)."""
    known = [float(v) for v in values if v is not None]
    return round(sum(known), 2) if known else None


@dataclass(frozen=True)
class NutritionTotals:
    calories: float | None
    protein_g: float | None
    carbohydrate_g: float | None
    fat_g: float | None
    fiber_g: float | None
    items_logged: int
    # Per nutrient: how many items had no value, so a total can be read as "at least".
    items_missing: dict[str, int]


def compute_totals(items: Iterable) -> NutritionTotals:
    items = list(items)
    sums = {n: sum_known(getattr(i, n) for i in items) for n in NUTRIENTS}
    missing = {n: sum(1 for i in items if getattr(i, n) is None) for n in NUTRIENTS}
    return NutritionTotals(items_logged=len(items), items_missing=missing, **sums)
