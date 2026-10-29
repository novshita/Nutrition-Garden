import pytest

from app.schemas.nutrition import Micronutrient, NutritionPer100g
from app.services.calculations.nutrition import (
    compute_totals,
    scale_nutrition,
    sum_known,
)


class Item:
    def __init__(self, **kw):
        self.calories = kw.get("calories")
        self.protein_g = kw.get("protein_g")
        self.carbohydrate_g = kw.get("carbohydrate_g")
        self.fat_g = kw.get("fat_g")
        self.fiber_g = kw.get("fiber_g")


PER_100G = NutritionPer100g(
    calories=130,
    protein_g=2.69,
    carbohydrate_g=28.2,
    fat_g=None,
    fiber_g=0,
    micronutrients={"iron": Micronutrient(amount=1.2, unit="mg")},
)


def test_scaling_by_grams():
    scaled = scale_nutrition(PER_100G, 237)
    assert scaled.calories == pytest.approx(308.1)
    assert scaled.protein_g == pytest.approx(6.38)
    assert scaled.micronutrients["iron"].amount == pytest.approx(2.844)


def test_scaling_keeps_unknown_as_none_and_zero_as_zero():
    scaled = scale_nutrition(PER_100G, 50)
    assert scaled.fat_g is None
    assert scaled.fiber_g == 0


@pytest.mark.parametrize("grams", [0, -5])
def test_scaling_rejects_non_positive_grams(grams):
    with pytest.raises(ValueError):
        scale_nutrition(PER_100G, grams)


def test_sum_known_ignores_none_but_all_none_is_none():
    assert sum_known([1.5, None, 2.0]) == 3.5
    assert sum_known([None, None]) is None
    assert sum_known([]) is None
    assert sum_known([0, None]) == 0


def test_totals_count_missing_values_per_nutrient():
    totals = compute_totals(
        [
            Item(calories=100, protein_g=5),
            Item(calories=50),
            Item(calories=0, protein_g=0, fat_g=3),
        ]
    )
    assert totals.items_logged == 3
    assert totals.calories == 150
    assert totals.protein_g == 5
    assert totals.fat_g == 3
    assert totals.carbohydrate_g is None
    assert totals.items_missing == {
        "calories": 0,
        "protein_g": 1,
        "carbohydrate_g": 3,
        "fat_g": 2,
        "fiber_g": 3,
    }


def test_totals_of_nothing():
    totals = compute_totals([])
    assert totals.items_logged == 0 and totals.calories is None
