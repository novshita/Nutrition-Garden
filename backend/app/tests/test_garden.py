import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.config import GARDEN_ITEM_CATALOG
from app.models import Garden, GardenGrowthEvent, GardenProgress


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct-horse", "display_name": "Rose"},
        ).status_code
        == 201
    )


def login(client, email):
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "correct-horse"})
    assert r.status_code == 200


def garden(client):
    return client.get("/api/v1/garden").json()


def milestones(client):
    return {
        (m["milestone_type"], m["trigger_value"])
        for m in client.get("/api/v1/garden/milestones").json()
    }


def days_ago(n):
    return datetime.now(UTC) - timedelta(days=n)


def water(client, n_days_ago=0, ml=250):
    r = client.post(
        "/api/v1/water", json={"amount_ml": ml, "consumed_at": days_ago(n_days_ago).isoformat()}
    )
    assert r.status_code == 201


def onboard(client, weight=50, goal=60):
    r = client.post(
        "/api/v1/profile",
        json={
            "date_of_birth": "2000-01-01",
            "sex": "FEMALE",
            "height_cm": 165,
            "weight_kg": weight,
            "goal_weight_kg": goal,
            "preferred_unit_system": "METRIC",
            "activity_level": "LIGHT",
            "timezone": "UTC",
        },
    )
    assert r.status_code == 201


# Basics --------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["/api/v1/garden", "/api/v1/garden/items", "/api/v1/garden/milestones"],
)
def test_requires_authentication(client, path):
    assert client.get(path).status_code == 401
    assert client.post(f"/api/v1/garden/items/{uuid.uuid4()}/place", json={"x": 0.5, "y": 0.5}).status_code == 401


def test_new_garden_starts_at_stage_one_with_starter_items(client):
    signup(client)
    g = garden(client)
    assert (g["growth_points"], g["growth_stage"], g["bunny_stage"]) == (0, 1, 1)
    assert g["next_stage_at_points"] == 50 and g["points_to_next_stage"] == 50
    assert g["today_actions"] == []
    items = client.get("/api/v1/garden/items").json()
    stage_one = {key for stage, _, key in GARDEN_ITEM_CATALOG if stage == 1}
    assert {i["item_key"] for i in items} == stage_one
    assert all(i["placed"] is False and i["position"] is None for i in items)
    assert milestones(client) == set()


def test_opening_the_garden_twice_does_not_duplicate_it(client, db):
    signup(client)
    garden(client)
    garden(client)
    assert len(db.scalars(select(Garden)).all()) == 1
    assert len(client.get("/api/v1/garden/items").json()) == 3


# Growth --------------------------------------------------------------------------------


def test_each_positive_action_grows_the_garden_by_one_point(client):
    signup(client)
    day = datetime.now(UTC).date().isoformat()
    water(client)
    client.put(f"/api/v1/mood/{day}", json={"mood": "GOOD"})
    client.put(f"/api/v1/activity/{day}", json={"steps": 2500})
    client.put(f"/api/v1/sleep/{day}", json={"duration_minutes": 480})
    client.post("/api/v1/weight", json={"weight_kg": 50})
    client.post(
        "/api/v1/food/log",
        json={
            "meal_type": "LUNCH",
            "items": [
                {"food_source": "CUSTOM", "food_name": "Dal", "quantity": 1, "unit": "bowl", "calories": 300}
            ],
        },
    )
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "T",
            "exercises": [
                {"exercise_name": "Push-ups", "exercise_type": "REPS", "category": "UPPER_BODY", "default_reps": 10}
            ],
        },
    ).json()
    end = datetime.now(UTC) - timedelta(minutes=5)
    client.post(
        "/api/v1/workouts/sessions",
        json={
            "template_id": template["id"],
            "started_at": (end - timedelta(minutes=30)).isoformat(),
            "completed_at": end.isoformat(),
        },
    )
    g = garden(client)
    assert g["growth_points"] == 7
    assert set(g["today_actions"]) == {
        "WATER_LOGGED",
        "MOOD_LOGGED",
        "STEPS_LOGGED",
        "SLEEP_LOGGED",
        "WEIGHT_LOGGED",
        "FOOD_LOGGED",
        "WORKOUT_COMPLETED",
    }


def test_an_action_earns_points_once_per_day(client):
    signup(client)
    for _ in range(5):
        water(client)
    day = datetime.now(UTC).date().isoformat()
    for steps in (1000, 2000, 3000):
        client.put(f"/api/v1/activity/{day}", json={"steps": steps})
    assert garden(client)["growth_points"] == 2


def test_backdated_entries_earn_growth_for_their_own_day(client):
    signup(client)
    water(client, 0)
    water(client, 1)
    water(client, 2)
    assert garden(client)["growth_points"] == 3
    assert garden(client)["today_actions"] == ["WATER_LOGGED"]


def test_zero_water_does_not_earn_growth(client):
    signup(client)
    water(client, ml=0)
    assert garden(client)["growth_points"] == 0


def test_onboarding_weight_counts_as_weight_logged(client):
    signup(client)
    onboard(client)
    assert "WEIGHT_LOGGED" in garden(client)["today_actions"]


# Calorie target "reasonably met" -------------------------------------------------------


def eat(client, calories):
    client.post(
        "/api/v1/food/log",
        json={
            "meal_type": "DINNER",
            "items": [
                {"food_source": "CUSTOM", "food_name": "Meal", "quantity": 1, "unit": "plate", "calories": calories}
            ],
        },
    )


def test_calorie_target_met_at_ninety_percent_and_over_is_still_fine(client):
    signup(client)
    onboard(client)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2000})
    eat(client, 1700)  # 85%
    assert "CALORIE_TARGET_MET" not in garden(client)["today_actions"]
    eat(client, 200)  # 1900 = 95%
    assert "CALORIE_TARGET_MET" in garden(client)["today_actions"]
    points = garden(client)["growth_points"]
    eat(client, 1500)  # well over the target: no penalty, no extra points
    assert garden(client)["growth_points"] == points


# Stages, items, milestones -------------------------------------------------------------


def test_reaching_fifty_points_unlocks_stage_two_items_and_milestones(client):
    signup(client)
    for n in range(50):
        water(client, n)
    g = garden(client)
    assert (g["growth_points"], g["growth_stage"], g["bunny_stage"]) == (50, 2, 2)
    assert g["next_stage_at_points"] == 150 and g["points_to_next_stage"] == 100
    keys = {i["item_key"] for i in client.get("/api/v1/garden/items").json()}
    assert keys == {key for stage, _, key in GARDEN_ITEM_CATALOG if stage <= 2}
    found = milestones(client)
    assert ("GARDEN_STAGE", 2) in found
    assert {("HYDRATION_MILESTONE", 7), ("HYDRATION_MILESTONE", 30)} <= found
    assert ("FIRST_WEEK", 7) in found


def test_first_log_milestone(client):
    signup(client)
    assert ("FIRST_LOG", 1) not in milestones(client)
    eat(client, 400)
    assert ("FIRST_LOG", 1) in milestones(client)


def test_workout_day_milestones(client):
    signup(client)
    template = client.post(
        "/api/v1/workouts/templates",
        json={
            "name": "T",
            "exercises": [
                {"exercise_name": "Plank", "exercise_type": "TIME", "category": "CORE", "default_duration_seconds": 30}
            ],
        },
    ).json()
    for n in (4, 2, 0):
        end = days_ago(n) - timedelta(minutes=5)
        client.post(
            "/api/v1/workouts/sessions",
            json={
                "template_id": template["id"],
                "started_at": (end - timedelta(minutes=20)).isoformat(),
                "completed_at": end.isoformat(),
            },
        )
    assert ("WORKOUT_STREAK", 3) in milestones(client)
    assert ("WORKOUT_STREAK", 7) not in milestones(client)


def test_weight_milestones_follow_progress_toward_goal_and_are_kept(client):
    signup(client)
    onboard(client, weight=50, goal=60)
    assert not {m for m in milestones(client) if m[0] == "WEIGHT_MILESTONE"}
    client.post("/api/v1/weight", json={"weight_kg": 56, "recorded_at": days_ago(0).isoformat()})
    assert {("WEIGHT_MILESTONE", 25), ("WEIGHT_MILESTONE", 50)} <= milestones(client)
    # Weight dipping later never takes a milestone away.
    client.post("/api/v1/weight", json={"weight_kg": 51, "recorded_at": (days_ago(0) + timedelta(minutes=1)).isoformat()})
    assert {("WEIGHT_MILESTONE", 25), ("WEIGHT_MILESTONE", 50)} <= milestones(client)
    assert ("WEIGHT_MILESTONE", 75) not in milestones(client)


# Mandatory business-logic test #6 ------------------------------------------------------


def test_missing_or_undoing_activity_cannot_reduce_progress(client, db):
    signup(client)
    for n in range(8):
        water(client, n)
    entries = client.get("/api/v1/water").json()["entries"]
    before = garden(client)
    items_before = client.get("/api/v1/garden/items").json()
    milestones_before = milestones(client)
    assert before["growth_points"] == 8

    # Deleting entries (undoing a log) does not remove earned growth or let it be farmed again.
    for entry in entries:
        client.delete(f"/api/v1/water/{entry['id']}")
    after = garden(client)
    assert after["growth_points"] == before["growth_points"]
    assert after["growth_stage"] == before["growth_stage"]
    assert client.get("/api/v1/garden/items").json() == items_before
    assert milestones(client) == milestones_before
    water(client, 0)  # same action, same day, already earned
    assert garden(client)["growth_points"] == 8

    # Days with nothing logged leave no trace in the ledger.
    assert len(db.scalars(select(GardenGrowthEvent)).all()) == 8


def test_progress_cannot_be_made_negative_in_the_database(client, db):
    signup(client)
    garden(client)
    with pytest.raises(IntegrityError):
        db.execute(update(GardenProgress).values(growth_points=-1))
        db.flush()


# Placing items -------------------------------------------------------------------------


def test_place_item_persists_in_the_database(client):
    signup(client)
    item = client.get("/api/v1/garden/items").json()[0]
    r = client.post(
        f"/api/v1/garden/items/{item['id']}/place", json={"x": 0.25, "y": 0.75, "rotation": 30}
    )
    assert r.status_code == 200
    assert r.json()["placed"] is True and r.json()["position"] == {"x": 0.25, "y": 0.75}
    saved = next(i for i in client.get("/api/v1/garden/items").json() if i["id"] == item["id"])
    assert (saved["position"], saved["rotation"], saved["placed"]) == ({"x": 0.25, "y": 0.75}, 30, True)
    client.post(f"/api/v1/garden/items/{item['id']}/place", json={"x": 0.9, "y": 0.1})
    moved = next(i for i in client.get("/api/v1/garden/items").json() if i["id"] == item["id"])
    assert moved["position"] == {"x": 0.9, "y": 0.1} and moved["rotation"] == 0


@pytest.mark.parametrize(
    "body",
    [{"x": -0.1, "y": 0.5}, {"x": 1.1, "y": 0.5}, {"x": 0.5, "y": 2}, {"x": 0.5}, {"x": "a", "y": 0.5}, {"x": 0.5, "y": 0.5, "rotation": 400}],
)
def test_invalid_placement_rejected(client, body):
    signup(client)
    item = client.get("/api/v1/garden/items").json()[0]
    assert client.post(f"/api/v1/garden/items/{item['id']}/place", json=body).status_code == 422
    assert client.get("/api/v1/garden/items").json()[0]["placed"] is False


def test_cannot_place_unknown_locked_or_other_users_items(client):
    signup(client, "a@example.com")
    mine = client.get("/api/v1/garden/items").json()[0]
    assert client.post(f"/api/v1/garden/items/{uuid.uuid4()}/place", json={"x": 0.5, "y": 0.5}).status_code == 404
    assert client.post("/api/v1/garden/items/not-a-uuid/place", json={"x": 0.5, "y": 0.5}).status_code == 422
    signup(client, "b@example.com")
    assert client.post(f"/api/v1/garden/items/{mine['id']}/place", json={"x": 0.5, "y": 0.5}).status_code == 404
    login(client, "a@example.com")
    assert client.get("/api/v1/garden/items").json()[0]["placed"] is False


def test_gardens_are_private_and_independent(client):
    signup(client, "a@example.com")
    for n in range(3):
        water(client, n)
    signup(client, "b@example.com")
    assert garden(client)["growth_points"] == 0
    assert milestones(client) == set()
    login(client, "a@example.com")
    assert garden(client)["growth_points"] == 3
