from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import FoodLog, FoodLogItem

RICE = 168878  # per 100 g: 130 kcal, 2.69 g protein, 28.2 g carbs, fat/fiber unknown
EGG = 171287  # per 100 g: 143 kcal, 12.56 g protein, 9.51 g fat, 0.72 g carbs, 0 g fiber


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct-horse", "display_name": "Rose"},
        ).status_code
        == 201
    )


def usda_item(fdc_id=RICE, quantity=100, unit="g"):
    return {"food_source": "USDA", "fdc_id": fdc_id, "quantity": quantity, "unit": unit}


def custom_item(**overrides):
    item = {
        "food_source": "CUSTOM",
        "food_name": "Mum's dal",
        "quantity": 1,
        "unit": "bowl",
        "calories": 200,
    }
    return {**item, **overrides}


def post_log(client, items, meal_type="LUNCH", **extra):
    return client.post(
        "/api/v1/food/log", json={"meal_type": meal_type, "items": items, **extra}
    )


# Auth ----------------------------------------------------------------------------------


def test_requires_authentication(client, usda):
    assert post_log(client, [custom_item()]).status_code == 401
    assert client.get("/api/v1/food/log").status_code == 401
    assert client.get("/api/v1/nutrition/daily").status_code == 401


# Creating logs -------------------------------------------------------------------------


def test_usda_item_nutrition_is_calculated_by_the_backend(client, usda):
    signup(client)
    r = post_log(client, [usda_item(RICE, 1.5, "1 cup")])
    assert r.status_code == 201
    item = r.json()["items"][0]
    assert item["food_source"] == "USDA" and item["external_food_id"] == str(RICE)
    assert item["food_name"] == "Rice, white, long-grain, cooked"
    assert item["serving_size"] == 158  # grams in one "1 cup"
    assert item["calories"] == pytest.approx(308.1)  # 130 * 237 g / 100
    assert item["protein_g"] == pytest.approx(6.38)
    assert item["carbohydrate_g"] == pytest.approx(66.83)
    assert item["fat_g"] is None and item["fiber_g"] is None  # unknown, not zero
    assert item["micronutrients"]["iron"]["amount"] == pytest.approx(2.844)


def test_grams_unit_and_case_insensitive_portion(client, usda):
    signup(client)
    by_grams = post_log(client, [usda_item(RICE, 200, "G")]).json()["items"][0]
    assert by_grams["calories"] == 260 and by_grams["serving_size"] == 1
    half = post_log(client, [usda_item(RICE, 2, "1/2 CUP")]).json()["items"][0]
    assert half["calories"] == pytest.approx(205.4)  # 2 * 79 g


def test_client_cannot_supply_nutrition_for_usda_foods(client, usda):
    signup(client)
    item = {**usda_item(RICE, 100), "calories": 1}
    assert post_log(client, [item]).json()["items"][0]["calories"] == 130


def test_unknown_unit_lists_valid_options_and_saves_nothing(client, usda, db):
    signup(client)
    r = post_log(client, [custom_item(), usda_item(RICE, 1, "handful")])
    assert r.status_code == 422
    assert "1 cup" in r.json()["detail"]
    assert db.scalars(select(FoodLog)).all() == []


def test_custom_item_unknown_nutrients_stay_null(client, usda):
    signup(client)
    item = post_log(client, [custom_item(protein_g=8)]).json()["items"][0]
    assert item["food_source"] == "CUSTOM" and item["external_food_id"] is None
    assert item["calories"] == 200 and item["protein_g"] == 8
    assert item["carbohydrate_g"] is None and item["fat_g"] is None
    assert item["serving_size"] is None


def test_log_totals_and_item_order(client, usda):
    signup(client)
    body = post_log(
        client, [usda_item(RICE, 100), usda_item(EGG, 100), custom_item(food_name="Last")]
    ).json()
    assert [i["food_name"] for i in body["items"]][-1] == "Last"
    assert body["items"][0]["external_food_id"] == str(RICE)
    assert body["totals"]["calories"] == 473
    assert body["totals"]["items_logged"] == 3


def test_nutrition_is_a_snapshot(client, usda, db):
    signup(client)
    post_log(client, [usda_item(RICE, 100)])
    usda.foods[RICE] = {
        **usda.foods[RICE],
        "foodNutrients": [
            {"nutrient": {"id": 1008, "unitName": "kcal"}, "amount": 999},
        ],
    }
    cached = db.scalar(select(FoodLogItem))
    assert float(cached.calories) == 130  # later USDA changes never rewrite history


def test_unknown_usda_food_is_404_and_saves_nothing(client, usda, db):
    signup(client)
    assert post_log(client, [custom_item(), usda_item(999999999)]).status_code == 404
    assert db.scalars(select(FoodLog)).all() == []


def test_usda_down_returns_503_but_custom_food_still_works(client, usda):
    signup(client)
    usda.unavailable = True
    r = post_log(client, [usda_item(RICE)])
    assert r.status_code == 503 and "enter the food manually" in r.json()["detail"]
    assert post_log(client, [custom_item()]).status_code == 201


def test_cached_food_can_be_logged_while_usda_is_down(client, usda):
    signup(client)
    client.get(f"/api/v1/food/{RICE}")  # caches it
    usda.unavailable = True
    assert post_log(client, [usda_item(RICE, 100)]).status_code == 201


@pytest.mark.parametrize(
    "items",
    [
        [],
        [custom_item(calories=-1)],
        [custom_item(calories="lots")],
        [custom_item(calories=20_001)],
        [custom_item(protein_g=-2)],
        [custom_item(quantity=0)],
        [custom_item(food_name="")],
        [usda_item(quantity=0)],
        [usda_item(quantity=-3)],
        [usda_item(fdc_id=0)],
        [usda_item(unit="")],
        [{"food_source": "AI_INTERPRETED", "food_name": "x", "quantity": 1, "unit": "g", "calories": 1}],
        [{"food_source": "NOPE"}],
        [custom_item()] * 31,
    ],
)
def test_invalid_items_rejected(client, usda, db, items):
    signup(client)
    assert post_log(client, items).status_code == 422
    assert db.scalars(select(FoodLog)).all() == []


def test_invalid_meal_type_and_future_time_rejected(client, usda):
    signup(client)
    assert post_log(client, [custom_item()], meal_type="BRUNCH").status_code == 422
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert post_log(client, [custom_item()], consumed_at=future).status_code == 422
    assert post_log(client, [custom_item()], consumed_at="2026-01-01T10:00:00").status_code == 422


def test_ai_interpreted_items_cannot_be_saved_through_this_endpoint(client, usda, db):
    """Mandatory business-logic test #4: AI output is a proposal until confirmed elsewhere."""
    signup(client)
    ai_item = {
        "food_source": "AI_INTERPRETED",
        "food_name": "2 eggs",
        "quantity": 2,
        "unit": "egg",
        "calories": 140,
    }
    assert post_log(client, [ai_item]).status_code == 422
    assert db.scalars(select(FoodLogItem)).all() == []


# Reading logs and daily totals ---------------------------------------------------------


def test_list_logs_for_a_day(client, usda):
    signup(client)
    yesterday = (datetime.now(UTC) - timedelta(days=1)).replace(hour=12).isoformat()
    post_log(client, [custom_item()], consumed_at=yesterday)
    post_log(client, [custom_item(food_name="Toast", calories=80)], meal_type="BREAKFAST")
    today = client.get("/api/v1/food/log").json()
    assert [i["food_name"] for log in today["logs"] for i in log["items"]] == ["Toast"]
    past = client.get("/api/v1/food/log", params={"day": yesterday[:10]}).json()
    assert len(past["logs"]) == 1


def test_daily_totals_null_is_not_zero(client, usda):
    """Mandatory business-logic test #5."""
    signup(client)
    post_log(client, [usda_item(RICE, 100)])  # protein 2.69, carbs 28.2, fat/fiber unknown
    post_log(client, [usda_item(EGG, 100)])  # 143 kcal, 12.56 protein, 9.51 fat, 0 fiber
    post_log(client, [custom_item(calories=200)])  # only calories known
    t = client.get("/api/v1/nutrition/daily").json()["totals"]
    assert t["calories"] == 473
    assert t["protein_g"] == pytest.approx(15.25)
    assert t["carbohydrate_g"] == pytest.approx(28.92)
    assert t["fat_g"] == pytest.approx(9.51)
    assert t["fiber_g"] == 0  # egg's real zero; rice and dal unknown
    assert t["items_logged"] == 3
    assert t["items_missing"] == {
        "calories": 0,
        "protein_g": 1,
        "carbohydrate_g": 1,
        "fat_g": 2,
        "fiber_g": 2,
    }


def test_daily_total_is_null_when_nothing_is_known(client, usda):
    signup(client)
    post_log(client, [custom_item()])
    t = client.get("/api/v1/nutrition/daily").json()["totals"]
    assert t["calories"] == 200
    assert t["protein_g"] is None and t["fat_g"] is None


def test_empty_day(client):
    signup(client)
    body = client.get("/api/v1/nutrition/daily").json()
    assert body["totals"]["calories"] is None and body["totals"]["items_logged"] == 0
    assert body["calorie_target_kcal"] is None and body["calories_remaining"] is None


def test_remaining_calories_against_target_never_negative(client, usda):
    signup(client)
    client.post(
        "/api/v1/profile",
        json={
            "date_of_birth": "2000-01-01",
            "sex": "FEMALE",
            "height_cm": 165,
            "weight_kg": 50,
            "goal_weight_kg": 56,
            "preferred_unit_system": "METRIC",
            "activity_level": "LIGHT",
            "timezone": "UTC",
        },
    )
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2000})
    assert client.get("/api/v1/nutrition/daily").json()["calories_remaining"] == 2000
    post_log(client, [custom_item(calories=600)])
    body = client.get("/api/v1/nutrition/daily").json()
    assert body["calorie_target_kcal"] == 2000 and body["calories_remaining"] == 1400
    post_log(client, [custom_item(calories=2500)])
    assert client.get("/api/v1/nutrition/daily").json()["calories_remaining"] == 0


def test_day_boundaries_follow_user_timezone(client, usda):
    signup(client)
    client.post(
        "/api/v1/profile",
        json={
            "date_of_birth": "2000-01-01",
            "sex": "FEMALE",
            "height_cm": 165,
            "weight_kg": 50,
            "goal_weight_kg": 56,
            "preferred_unit_system": "METRIC",
            "activity_level": "LIGHT",
            "timezone": "Pacific/Kiritimati",  # UTC+14
        },
    )
    post_log(client, [custom_item(calories=300)], consumed_at="2026-03-10T11:00:00+00:00")
    on_local_day = client.get("/api/v1/nutrition/daily", params={"day": "2026-03-11"}).json()
    other_day = client.get("/api/v1/nutrition/daily", params={"day": "2026-03-10"}).json()
    assert on_local_day["totals"]["calories"] == 300
    assert other_day["totals"]["items_logged"] == 0


def test_users_cannot_see_each_others_food_logs(client, usda):
    """Mandatory business-logic test #9 for food data."""
    signup(client, "a@example.com")
    post_log(client, [custom_item(calories=500)])
    signup(client, "b@example.com")
    assert client.get("/api/v1/food/log").json()["logs"] == []
    assert client.get("/api/v1/nutrition/daily").json()["totals"]["calories"] is None


def test_food_log_route_is_not_shadowed_by_fdc_id_route(client, usda):
    signup(client)
    assert client.get("/api/v1/food/log").status_code == 200
    assert client.get("/api/v1/food/search", params={"query": "egg"}).status_code == 200
