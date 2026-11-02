import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app import config
from app.models import FoodLog, Recipe
from app.tests.ai_helpers import login, signup

URL = "/api/v1/recipes"


def recipe(**overrides):
    base = {
        "name": "Peanut butter oats",
        "description": "Creamy and filling",
        "servings": 2,
        "serving_size": "1 bowl",
        "calories": 400,
        "protein_g": 20,
        "carbohydrate_g": 50,
        "fat_g": 15,
        "fiber_g": 8,
        "ingredients": ["1 cup oats", "2 tbsp peanut butter", "1 cup milk"],
        "alternatives": ["Use almond butter"],
        "instructions": "Cook the oats in the milk, stir in the peanut butter.",
    }
    return {**base, **overrides}


def make(client, **overrides):
    r = client.post(URL, json=recipe(**overrides))
    assert r.status_code == 201, r.text
    return r.json()


def log(client, recipe_id, servings=1, meal="BREAKFAST", **extra):
    return client.post(f"{URL}/{recipe_id}/log", json={"servings": servings, "meal_type": meal, **extra})


# Auth ----------------------------------------------------------------------------------


def test_requires_authentication(client):
    rid = uuid.uuid4()
    assert client.get(URL).status_code == 401
    assert client.post(URL, json=recipe()).status_code == 401
    assert client.get(f"{URL}/{rid}").status_code == 401
    assert client.put(f"{URL}/{rid}", json=recipe()).status_code == 401
    assert client.delete(f"{URL}/{rid}").status_code == 401
    assert log(client, rid).status_code == 401


# Create, read, edit, delete -------------------------------------------------------------


def test_create_and_read_a_recipe(client):
    signup(client)
    created = make(client)
    assert created["name"] == "Peanut butter oats"
    assert created["servings"] == 2 and created["serving_size"] == "1 bowl"
    assert created["calories"] == 400 and created["protein_g"] == 20
    assert created["ingredients"] == ["1 cup oats", "2 tbsp peanut butter", "1 cup milk"]
    assert created["alternatives"] == ["Use almond butter"]
    assert client.get(f"{URL}/{created['id']}").json() == created


def test_a_minimal_recipe_is_fine_and_unknown_nutrition_stays_unknown(client):
    signup(client)
    r = client.post(URL, json={"name": "Toast"})
    assert r.status_code == 201
    body = r.json()
    assert body["servings"] == 1 and body["ingredients"] == [] and body["instructions"] is None
    for field in ("calories", "protein_g", "carbohydrate_g", "fat_g", "fiber_g"):
        assert body[field] is None  # unknown, not zero


def test_a_typed_zero_is_kept_as_zero(client):
    signup(client)
    body = make(client, protein_g=0, fiber_g=0)
    assert body["protein_g"] == 0 and body["fiber_g"] == 0


def test_text_is_tidied(client):
    signup(client)
    body = make(
        client,
        name="  Dal  ",
        description="   ",
        serving_size="",
        ingredients=["  rice ", "", "   ", "lentils"],
        alternatives=[" ", "brown rice"],
        instructions="  boil  ",
    )
    assert body["name"] == "Dal"
    assert body["description"] is None and body["serving_size"] is None
    assert body["ingredients"] == ["rice", "lentils"]
    assert body["alternatives"] == ["brown rice"]
    assert body["instructions"] == "boil"


def test_recipes_are_listed_alphabetically(client):
    signup(client)
    for name in ("banana bread", "Apple crumble", "Cheese toast"):
        make(client, name=name)
    assert [r["name"] for r in client.get(URL).json()] == ["Apple crumble", "banana bread", "Cheese toast"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 101},
        {"description": "x" * 501},
        {"servings": 0},
        {"servings": 51},
        {"servings": 1.5},
        {"serving_size": "x" * 101},
        {"calories": -1},
        {"calories": 2001},
        {"calories": "lots"},
        {"protein_g": -0.1},
        {"carbohydrate_g": 501},
        {"fat_g": "x"},
        {"fiber_g": 501},
        {"ingredients": ["x"] * 51},
        {"ingredients": ["x" * 201]},
        {"alternatives": ["x"] * 11},
        {"instructions": "x" * 5001},
    ],
)
def test_invalid_recipes_are_rejected(client, db, overrides):
    signup(client)
    assert client.post(URL, json=recipe(**overrides)).status_code == 422
    assert db.scalar(select(func.count()).select_from(Recipe)) == 0


def test_limits_are_inclusive(client):
    signup(client)
    make(client, calories=2000, protein_g=500, servings=50, ingredients=["x" * 200] * 50, name="x" * 100)


def test_editing_replaces_the_recipe(client):
    signup(client)
    created = make(client)
    r = client.put(f"{URL}/{created['id']}", json={"name": "Plain oats", "calories": 250})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == created["id"]
    assert body["name"] == "Plain oats" and body["calories"] == 250
    assert body["protein_g"] is None and body["ingredients"] == []  # replaced, not merged
    assert client.put(f"{URL}/{created['id']}", json=recipe(name="")).status_code == 422
    assert client.get(f"{URL}/{created['id']}").json()["name"] == "Plain oats"


def test_deleting_a_recipe(client):
    signup(client)
    created = make(client)
    assert client.delete(f"{URL}/{created['id']}").status_code == 204
    assert client.get(f"{URL}/{created['id']}").status_code == 404
    assert client.delete(f"{URL}/{created['id']}").status_code == 404
    assert client.get(URL).json() == []


def test_the_number_of_recipes_is_limited(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_RECIPES_PER_USER", 2)
    signup(client)
    make(client, name="One")
    make(client, name="Two")
    r = client.post(URL, json=recipe(name="Three"))
    assert r.status_code == 409 and "Delete a few" in r.json()["detail"]
    client.delete(f"{URL}/{client.get(URL).json()[0]['id']}")
    assert client.post(URL, json=recipe(name="Three")).status_code == 201


# Logging a serving ---------------------------------------------------------------------


def test_logging_servings_scales_the_nutrition(client):
    signup(client)
    created = make(client, calories=400, protein_g=20, carbohydrate_g=50, fat_g=15, fiber_g=8)
    r = log(client, created["id"], servings=1.5)
    assert r.status_code == 201
    entry = r.json()
    assert entry["meal_type"] == "BREAKFAST" and entry["source"] == "MANUAL"
    [item] = entry["items"]
    assert item["food_source"] == "CUSTOM" and item["food_name"] == "Peanut butter oats"
    assert item["quantity"] == 1.5 and item["unit"] == "serving"
    assert (item["calories"], item["protein_g"], item["carbohydrate_g"], item["fat_g"], item["fiber_g"]) == (600, 30, 75, 22.5, 12)
    assert client.get("/api/v1/nutrition/daily").json()["totals"]["calories"] == 600


def test_unknown_nutrients_stay_unknown_when_logged(client):
    """Mandatory business-logic test #5 for recipes: unknown is never zero."""
    signup(client)
    created = client.post(URL, json={"name": "Mystery stew", "calories": 300}).json()
    [item] = log(client, created["id"], servings=2).json()["items"]
    assert item["calories"] == 600
    for field in ("protein_g", "carbohydrate_g", "fat_g", "fiber_g"):
        assert item[field] is None
    totals = client.get("/api/v1/nutrition/daily").json()["totals"]
    assert totals["protein_g"] is None and totals["items_missing"]["protein_g"] == 1


def test_a_recipe_without_calories_cannot_be_logged_yet(client, db):
    signup(client)
    created = client.post(URL, json={"name": "No numbers", "protein_g": 10}).json()
    r = log(client, created["id"])
    assert r.status_code == 409 and "Add calories" in r.json()["detail"]
    assert db.scalar(select(func.count()).select_from(FoodLog)) == 0


def test_scaled_values_are_rounded_sensibly(client):
    signup(client)
    created = make(client, calories=333.33, protein_g=11.11)
    [item] = log(client, created["id"], servings=3).json()["items"]
    assert item["calories"] == 999.99 and item["protein_g"] == 33.33


@pytest.mark.parametrize("servings", [0, -1, 10.01, 11, "lots", None])
def test_serving_counts_are_validated(client, db, servings):
    signup(client)
    created = make(client)
    r = client.post(f"{URL}/{created['id']}/log", json={"servings": servings, "meal_type": "LUNCH"})
    assert r.status_code == 422
    assert db.scalar(select(func.count()).select_from(FoodLog)) == 0


def test_the_largest_serving_count_still_fits_the_food_log(client):
    signup(client)
    created = make(client, calories=2000, protein_g=500, carbohydrate_g=500, fat_g=500, fiber_g=500)
    r = log(client, created["id"], servings=10)
    assert r.status_code == 201
    assert r.json()["items"][0]["calories"] == 20000


def test_meal_type_and_time_are_checked(client):
    signup(client)
    created = make(client)
    assert log(client, created["id"], meal="BRUNCH").status_code == 422
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert log(client, created["id"], consumed_at=future).status_code == 422
    assert log(client, created["id"], consumed_at="2026-01-01T10:00:00").status_code == 422
    past = (datetime.now(UTC) - timedelta(days=2)).isoformat()
    assert log(client, created["id"], consumed_at=past).status_code == 201


def test_logging_is_a_snapshot_edits_and_deletes_never_rewrite_it(client):
    signup(client)
    created = make(client, calories=400)
    log(client, created["id"])
    client.put(f"{URL}/{created['id']}", json={"name": "Different", "calories": 999})
    client.delete(f"{URL}/{created['id']}")
    [meal] = client.get("/api/v1/food/log").json()["logs"]
    assert meal["items"][0]["food_name"] == "Peanut butter oats"
    assert meal["items"][0]["calories"] == 400


def test_logging_a_recipe_grows_the_garden_like_any_meal(client):
    signup(client)
    created = make(client)
    log(client, created["id"])
    assert "FOOD_LOGGED" in client.get("/api/v1/garden").json()["today_actions"]


def test_logged_recipes_can_be_removed_like_any_meal(client):
    signup(client)
    created = make(client)
    entry = log(client, created["id"]).json()
    assert client.delete(f"/api/v1/food/log/{entry['id']}").status_code == 204
    assert client.get("/api/v1/food/log").json()["logs"] == []


# Privacy -------------------------------------------------------------------------------


def test_recipes_are_private(client):
    signup(client, "a@example.com")
    mine = make(client)
    signup(client, "b@example.com")
    assert client.get(URL).json() == []
    assert client.get(f"{URL}/{mine['id']}").status_code == 404
    assert client.put(f"{URL}/{mine['id']}", json=recipe(name="Stolen")).status_code == 404
    assert client.delete(f"{URL}/{mine['id']}").status_code == 404
    assert log(client, mine["id"]).status_code == 404
    assert client.get("/api/v1/food/log").json()["logs"] == []
    login(client, "a@example.com")
    assert client.get(f"{URL}/{mine['id']}").json()["name"] == "Peanut butter oats"


def test_unknown_and_malformed_ids(client):
    signup(client)
    assert client.get(f"{URL}/{uuid.uuid4()}").status_code == 404
    assert client.get(f"{URL}/not-a-uuid").status_code == 422
    assert log(client, uuid.uuid4()).status_code == 404
