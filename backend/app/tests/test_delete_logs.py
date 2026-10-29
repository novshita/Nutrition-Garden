import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import FoodLog, FoodLogItem


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct-horse", "display_name": "Rose"},
        ).status_code
        == 201
    )


def custom(name="Dal", calories=200):
    return {
        "food_source": "CUSTOM",
        "food_name": name,
        "quantity": 1,
        "unit": "bowl",
        "calories": calories,
    }


def make_log(client, *items):
    r = client.post("/api/v1/food/log", json={"meal_type": "LUNCH", "items": list(items)})
    assert r.status_code == 201
    return r.json()


def calories_today(client):
    return client.get("/api/v1/nutrition/daily").json()["totals"]["calories"]


UNKNOWN = str(uuid.uuid4())


@pytest.mark.parametrize(
    "path",
    [
        f"/api/v1/food/log/{UNKNOWN}",
        f"/api/v1/food/log/{UNKNOWN}/items/{UNKNOWN}",
        f"/api/v1/water/{UNKNOWN}",
        f"/api/v1/weight/{UNKNOWN}",
    ],
)
def test_delete_requires_authentication(client, path):
    assert client.delete(path).status_code == 401


# Food logs -----------------------------------------------------------------------------


def test_delete_food_log_removes_meal_items_and_totals(client, db):
    signup(client)
    keep = make_log(client, custom("Toast", 80))
    gone = make_log(client, custom("Dal", 200), custom("Rice", 150))
    assert calories_today(client) == 430
    assert client.delete(f"/api/v1/food/log/{gone['id']}").status_code == 204
    assert calories_today(client) == 80
    assert [log["id"] for log in client.get("/api/v1/food/log").json()["logs"]] == [keep["id"]]
    assert len(db.scalars(select(FoodLogItem)).all()) == 1  # items removed with their meal


def test_delete_one_item_from_a_meal(client):
    signup(client)
    log = make_log(client, custom("Dal", 200), custom("Rice", 150))
    first_item = log["items"][0]["id"]
    assert client.delete(f"/api/v1/food/log/{log['id']}/items/{first_item}").status_code == 204
    remaining = client.get("/api/v1/food/log").json()["logs"][0]
    assert [i["food_name"] for i in remaining["items"]] == ["Rice"]
    assert remaining["totals"]["calories"] == 150


def test_deleting_the_last_item_removes_the_empty_meal(client, db):
    signup(client)
    log = make_log(client, custom("Dal", 200))
    item_id = log["items"][0]["id"]
    assert client.delete(f"/api/v1/food/log/{log['id']}/items/{item_id}").status_code == 204
    assert client.get("/api/v1/food/log").json()["logs"] == []
    assert db.scalars(select(FoodLog)).all() == []


def test_item_must_belong_to_the_given_meal(client):
    signup(client)
    a = make_log(client, custom("Dal"))
    b = make_log(client, custom("Rice"))
    wrong = client.delete(f"/api/v1/food/log/{a['id']}/items/{b['items'][0]['id']}")
    assert wrong.status_code == 404
    assert len(client.get("/api/v1/food/log").json()["logs"]) == 2


def test_delete_missing_or_malformed_food_ids(client):
    signup(client)
    assert client.delete(f"/api/v1/food/log/{UNKNOWN}").status_code == 404
    assert client.delete("/api/v1/food/log/not-a-uuid").status_code == 422
    log = make_log(client, custom())
    assert client.delete(f"/api/v1/food/log/{log['id']}").status_code == 204
    assert client.delete(f"/api/v1/food/log/{log['id']}").status_code == 404  # already gone


def test_cannot_delete_another_users_food_log(client):
    """Mandatory business-logic test #9."""
    signup(client, "a@example.com")
    log = make_log(client, custom("Dal", 200))
    signup(client, "b@example.com")
    assert client.delete(f"/api/v1/food/log/{log['id']}").status_code == 404
    assert (
        client.delete(f"/api/v1/food/log/{log['id']}/items/{log['items'][0]['id']}").status_code
        == 404
    )
    client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "correct-horse"}
    )
    assert calories_today(client) == 200


# Water ---------------------------------------------------------------------------------


def test_delete_water_entry_updates_total(client):
    signup(client)
    keep = client.post("/api/v1/water", json={"amount_ml": 250}).json()
    gone = client.post("/api/v1/water", json={"amount_ml": 5000}).json()
    assert client.delete(f"/api/v1/water/{gone['id']}").status_code == 204
    day = client.get("/api/v1/water").json()
    assert day["total_ml"] == 250 and [e["id"] for e in day["entries"]] == [keep["id"]]
    assert client.delete(f"/api/v1/water/{gone['id']}").status_code == 404


def test_cannot_delete_another_users_water_entry(client):
    signup(client, "a@example.com")
    entry = client.post("/api/v1/water", json={"amount_ml": 250}).json()
    signup(client, "b@example.com")
    assert client.delete(f"/api/v1/water/{entry['id']}").status_code == 404
    client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "correct-horse"}
    )
    assert client.get("/api/v1/water").json()["total_ml"] == 250


# Weight --------------------------------------------------------------------------------


def log_weight(client, kg, days_ago=0):
    at = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    r = client.post("/api/v1/weight", json={"weight_kg": kg, "recorded_at": at})
    assert r.status_code == 201
    return r.json()


def test_delete_a_mistyped_weight(client):
    signup(client)
    log_weight(client, 50.0, days_ago=2)
    typo = log_weight(client, 400.0)
    assert client.delete(f"/api/v1/weight/{typo['id']}").status_code == 204
    assert [w["weight_kg"] for w in client.get("/api/v1/weight").json()] == [50.0]


def test_cannot_delete_the_only_weight_entry(client):
    signup(client)
    only = log_weight(client, 50.0)
    r = client.delete(f"/api/v1/weight/{only['id']}")
    assert r.status_code == 409
    assert len(client.get("/api/v1/weight").json()) == 1


def test_profile_still_works_after_deleting_a_weight(client):
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
    newer = log_weight(client, 51.0)
    assert client.delete(f"/api/v1/weight/{newer['id']}").status_code == 204
    assert client.get("/api/v1/profile").json()["current_weight_kg"] == 50
    # The onboarding entry is now the only one and is protected.
    only = client.get("/api/v1/weight").json()[0]
    assert client.delete(f"/api/v1/weight/{only['id']}").status_code == 409
    assert client.get("/api/v1/bmi").status_code == 200


def test_cannot_delete_another_users_weight(client):
    signup(client, "a@example.com")
    log_weight(client, 50.0, days_ago=3)
    mine = log_weight(client, 51.0)
    signup(client, "b@example.com")
    log_weight(client, 70.0, days_ago=3)
    log_weight(client, 71.0)
    assert client.delete(f"/api/v1/weight/{mine['id']}").status_code == 404
    client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "correct-horse"}
    )
    assert len(client.get("/api/v1/weight").json()) == 2
