from datetime import UTC, datetime, timedelta

import pytest

from app.tests.ai_helpers import login, onboard, signup

URL = "/api/v1/profile"


def profile(client):
    return client.get(URL).json()


def patch(client, **fields):
    return client.patch(URL, json=fields)


# Auth and basics -----------------------------------------------------------------------


def test_requires_authentication(client):
    assert patch(client, sex="MALE").status_code == 401


def test_cannot_update_before_onboarding(client):
    signup(client)
    assert patch(client, sex="MALE").status_code == 404


def test_changes_only_what_is_sent(client):
    signup(client)
    onboard(client)
    before = profile(client)["profile"]
    r = patch(client, goal_weight_kg=60)
    assert r.status_code == 200
    after = r.json()["profile"]
    assert after["goal_weight_kg"] == 60
    assert {k: v for k, v in after.items() if k != "goal_weight_kg"} == {
        k: v for k, v in before.items() if k != "goal_weight_kg"
    }
    assert profile(client)["profile"]["goal_weight_kg"] == 60  # and it's saved


def test_every_editable_field_can_change(client):
    signup(client)
    onboard(client)
    r = patch(
        client,
        date_of_birth="1995-06-15",
        sex="MALE",
        height_cm=180.5,
        goal_weight_kg=72.5,
        preferred_unit_system="IMPERIAL",
        activity_level="VERY_ACTIVE",
        timezone="Asia/Kolkata",
    )
    assert r.status_code == 200
    saved = profile(client)["profile"]
    assert saved["date_of_birth"] == "1995-06-15"
    assert saved["sex"] == "MALE"
    assert saved["height_cm"] == 180.5
    assert saved["goal_weight_kg"] == 72.5
    assert saved["preferred_unit_system"] == "IMPERIAL"
    assert saved["activity_level"] == "VERY_ACTIVE"
    assert saved["timezone"] == "Asia/Kolkata"
    assert saved["goal_type"] == "GAIN_WEIGHT"


# The calorie goal is never changed silently ---------------------------------------------------


def test_the_calorie_goal_stays_put_while_the_estimate_updates(client):
    """Changing details shows a new estimate; the person decides about their goal (spec §12)."""
    signup(client)
    onboard(client)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2100})
    before = profile(client)
    history = client.get("/api/v1/goals/calorie-target").json()

    after = patch(client, activity_level="EXTRA_ACTIVE", height_cm=175).json()
    assert after["tdee_kcal"] > before["tdee_kcal"]  # the estimate moved
    assert after["bmr_kcal"] != before["bmr_kcal"]
    assert after["bmi"] != before["bmi"]
    assert after["calorie_target_kcal"] == 2100  # but the goal didn't
    assert client.get("/api/v1/goals/calorie-target").json() == history  # nor its history


def test_changing_units_changes_nothing_about_the_numbers(client):
    signup(client)
    onboard(client)
    before = profile(client)
    after = patch(client, preferred_unit_system="IMPERIAL").json()
    for key in ("bmi", "bmr_kcal", "tdee_kcal", "calorie_target_kcal", "current_weight_kg"):
        assert after[key] == before[key]
    assert after["profile"]["height_cm"] == before["profile"]["height_cm"]  # stored metric either way


def test_current_weight_cannot_be_changed_here(client):
    signup(client)
    onboard(client)
    assert patch(client, weight_kg=80).status_code == 422
    assert profile(client)["current_weight_kg"] == 50


def test_the_goal_type_and_unknown_fields_cannot_be_set(client):
    signup(client)
    onboard(client)
    for field in ({"goal_type": "LOSE_WEIGHT"}, {"user_id": "abc"}, {"email": "x@y.z"}, {"nonsense": 1}):
        assert client.patch(URL, json=field).status_code == 422


# Validation (the same rules as onboarding) -----------------------------------------------------


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {"height_cm": 49.9},
        {"height_cm": 260.1},
        {"height_cm": 0},
        {"height_cm": "tall"},
        {"goal_weight_kg": 19.9},
        {"goal_weight_kg": 400.1},
        {"goal_weight_kg": -5},
        {"sex": "OTHER"},
        {"activity_level": "LAZY"},
        {"preferred_unit_system": "STONE"},
        {"timezone": "Mars/Olympus"},
        {"timezone": ""},
        {"date_of_birth": "2999-01-01"},
        {"date_of_birth": "2020-01-01"},  # under 18
        {"date_of_birth": "1800-01-01"},  # over 120
        {"date_of_birth": "not-a-date"},
        {"height_cm": None},
        {"sex": None},
        {"timezone": None},
    ],
)
def test_invalid_changes_are_rejected_and_nothing_is_saved(client, fields):
    signup(client)
    onboard(client)
    before = profile(client)
    assert client.patch(URL, json=fields).status_code == 422
    assert profile(client) == before


def test_a_bad_field_stops_the_whole_update(client):
    signup(client)
    onboard(client)
    before = profile(client)
    r = patch(client, goal_weight_kg=60, height_cm=999)  # one good, one bad
    assert r.status_code == 422
    assert profile(client) == before


def test_limits_are_inclusive(client):
    signup(client)
    onboard(client)
    assert patch(client, height_cm=50, goal_weight_kg=20).status_code == 200
    assert patch(client, height_cm=260, goal_weight_kg=400).status_code == 200


def test_eighteen_is_allowed_and_a_day_short_is_not(client):
    signup(client)
    onboard(client)
    today = datetime.now(UTC).date()
    eighteen = today.replace(year=today.year - 18)
    assert patch(client, date_of_birth=eighteen.isoformat()).status_code == 200
    assert patch(client, date_of_birth=(eighteen + timedelta(days=1)).isoformat()).status_code == 422


# Effects elsewhere -----------------------------------------------------------------------------


def test_changing_the_timezone_changes_which_day_things_belong_to(client):
    signup(client)
    onboard(client, tz="UTC")
    day = (datetime.now(UTC).date() - timedelta(days=1)).isoformat()  # yesterday, so never in the future
    # 11:00 UTC is already the next day in Kiritimati (UTC+14).
    stamp = f"{day}T11:00:00+00:00"
    client.post("/api/v1/water", json={"amount_ml": 300, "consumed_at": stamp})
    assert client.get("/api/v1/water", params={"day": day}).json()["total_ml"] == 300
    patch(client, timezone="Pacific/Kiritimati")
    assert client.get("/api/v1/water", params={"day": day}).json()["total_ml"] == 0
    next_day = (datetime.fromisoformat(stamp).date() + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/water", params={"day": next_day}).json()["total_ml"] == 300
    patch(client, timezone="UTC")  # and back again: nothing was lost
    assert client.get("/api/v1/water", params={"day": day}).json()["total_ml"] == 300


def test_a_new_goal_weight_never_takes_earned_milestones_away(client):
    signup(client)
    onboard(client)  # 50 kg towards 56 kg
    client.post("/api/v1/weight", json={"weight_kg": 53, "recorded_at": datetime.now(UTC).isoformat()})
    earned = {
        (a["milestone_type"], a["trigger_value"])
        for a in client.get("/api/v1/garden/achievements").json()
        if a["unlocked"]
    }
    assert ("WEIGHT_MILESTONE", 25) in earned
    patch(client, goal_weight_kg=45)  # a goal below the starting weight: no longer a 'gain' goal
    after = {
        (a["milestone_type"], a["trigger_value"])
        for a in client.get("/api/v1/garden/achievements").json()
        if a["unlocked"]
    }
    assert earned <= after


def test_the_ai_sees_the_updated_profile(client, ai):
    from app.schemas.ai import AiChatOutput
    from app.tests.ai_helpers import chat_output

    signup(client)
    onboard(client)
    patch(client, goal_weight_kg=61, activity_level="MODERATE")
    ai.outputs[AiChatOutput] = chat_output("hi")
    client.post("/api/v1/ai/chat", json={"message": "hello"})
    assert '"goal_weight_kg": 61.0' in ai.last_input
    assert '"activity_level": "MODERATE"' in ai.last_input


# Privacy -----------------------------------------------------------------------------------


def test_updates_only_affect_the_person_making_them(client):
    signup(client, "a@example.com")
    onboard(client)
    signup(client, "b@example.com")
    onboard(client)
    patch(client, goal_weight_kg=70, sex="MALE")
    assert profile(client)["profile"]["goal_weight_kg"] == 70
    login(client, "a@example.com")
    assert profile(client)["profile"]["goal_weight_kg"] == 56
    assert profile(client)["profile"]["sex"] == "FEMALE"
