import pytest

from app.services.nutrition.usda_normalizer import normalize_food
from app.tests import usda_samples as samples


def test_search_shape_is_normalized():
    food = normalize_food(samples.EGG_SEARCH_ITEM)
    n = food.nutrition_per_100g
    assert (food.fdc_id, food.name, food.data_type) == (171287, "Egg, whole, raw, fresh", "SR Legacy")
    assert n.calories == 143
    assert n.protein_g == pytest.approx(12.56)
    assert n.carbohydrate_g == pytest.approx(0.72)
    assert n.fat_g == pytest.approx(9.51)
    assert n.micronutrients["calcium"].amount == 56
    assert n.micronutrients["calcium"].unit == "mg"


def test_true_zero_is_kept_as_zero():
    assert normalize_food(samples.EGG_SEARCH_ITEM).nutrition_per_100g.fiber_g == 0


def test_missing_nutrients_are_null_not_zero():
    n = normalize_food(samples.RICE_DETAIL).nutrition_per_100g
    assert n.fat_g is None  # explicit null from USDA
    assert n.fiber_g is None  # absent entirely
    assert "calcium" not in n.micronutrients


def test_detail_shape_and_atwater_energy_fallback():
    n = normalize_food(samples.RICE_DETAIL).nutrition_per_100g
    assert n.calories == 130
    assert n.protein_g == pytest.approx(2.69)
    assert n.micronutrients["iron"].amount == pytest.approx(1.2)


def test_energy_only_in_kilojoules_is_unknown_not_converted_or_zero():
    assert normalize_food(samples.KJ_ONLY).nutrition_per_100g.calories is None


def test_portions_use_descriptions_and_skip_unusable_entries():
    portions = normalize_food(samples.RICE_DETAIL).portions
    assert [(p.description, p.gram_weight) for p in portions] == [
        ("1 cup", 158),
        ("1/2 cup", 79),
    ]


def test_branded_food_has_brand_and_serving_portion():
    food = normalize_food(samples.BRANDED_SEARCH_ITEM)
    assert food.brand == "Sunny Farms"
    assert [(p.description, p.gram_weight) for p in food.portions] == [("1/3 cup", 30)]


def test_sparse_payload_does_not_crash():
    food = normalize_food({"fdcId": 5})
    assert food.name == "Food 5"
    assert food.nutrition_per_100g.calories is None
