import uuid

import pytest

from app.config import WATER_TARGET_ML
from app.tests.test_workouts import exercise, make_template, session_body, signup

BASE = "/api/v1/workouts/templates"


def edit_body(template, **overrides):
    """The template as the client would send it back: ids kept, ready to be changed."""
    body = {
        "name": template["name"],
        "description": template["description"],
        "difficulty": template["difficulty"],
        "exercises": [
            {k: v for k, v in e.items() if k != "order_index"} for e in template["exercises"]
        ],
    }
    return {**body, **overrides}


def put(client, template, **overrides):
    return client.put(f"{BASE}/{template['id']}", json=edit_body(template, **overrides))


def two_exercise_template(client):
    return make_template(
        client,
        "Upper Body",
        [exercise("Push-ups"), exercise("Plank", "TIME", "CORE")],
        description="Arms and core",
    )


# ---- Editing ----


def test_template_details_can_be_changed(client):
    signup(client)
    t = two_exercise_template(client)
    r = put(client, t, name="  Strength A ", description=None, difficulty="ADVANCED")
    assert r.status_code == 200
    body = r.json()
    assert (body["name"], body["description"], body["difficulty"]) == ("Strength A", None, "ADVANCED")
    assert client.get(BASE).json()[0]["name"] == "Strength A"


def test_existing_exercises_keep_their_identity_and_can_change(client):
    signup(client)
    t = two_exercise_template(client)
    pushups = t["exercises"][0]
    exercises = edit_body(t)["exercises"]
    exercises[0].update(exercise_name="Knee push-ups", default_sets=4, default_reps=8)
    body = put(client, t, exercises=exercises).json()
    first = body["exercises"][0]
    assert first["id"] == pushups["id"]
    assert (first["exercise_name"], first["default_sets"], first["default_reps"]) == ("Knee push-ups", 4, 8)


def test_exercises_can_be_added_removed_and_reordered(client):
    signup(client)
    t = two_exercise_template(client)
    pushups, plank = t["exercises"]
    new = exercise("Squats", category="LOWER_BODY")
    body = put(client, t, exercises=[new, {**plank}]).json()  # push-ups removed, squats first
    assert [e["exercise_name"] for e in body["exercises"]] == ["Squats", "Plank"]
    assert [e["order_index"] for e in body["exercises"]] == [0, 1]
    assert body["exercises"][1]["id"] == plank["id"]
    assert pushups["id"] not in {e["id"] for e in body["exercises"]}
    assert body["exercises"][0]["id"] not in {pushups["id"], plank["id"]}


def test_an_invalid_edit_changes_nothing(client):
    signup(client)
    t = two_exercise_template(client)
    bad_exercises = edit_body(t)["exercises"]
    bad_exercises[1]["default_duration_seconds"] = None  # a timed exercise needs a time
    assert put(client, t, name="Changed", exercises=bad_exercises).status_code == 422
    assert put(client, t, name="").status_code == 422
    assert put(client, t, exercises=[]).status_code == 422
    assert client.get(BASE).json()[0] == t


def test_difficulty_is_required_when_editing(client):
    signup(client)
    t = two_exercise_template(client)
    body = edit_body(t)
    del body["difficulty"]
    assert client.put(f"{BASE}/{t['id']}", json=body).status_code == 422


def test_exercise_ids_must_belong_to_this_workout(client):
    signup(client)
    t = two_exercise_template(client)
    other = make_template(client, "Lower Body", [exercise("Squats", category="LOWER_BODY")])
    foreign = other["exercises"][0]
    for bad_id in (str(uuid.uuid4()), foreign["id"]):
        exercises = edit_body(t)["exercises"]
        exercises[0]["id"] = bad_id
        assert put(client, t, exercises=exercises).status_code == 422
    saved = {x["id"]: x for x in client.get(BASE).json()}
    assert saved == {t["id"]: t, other["id"]: other}


def test_an_exercise_cannot_appear_twice(client):
    signup(client)
    t = two_exercise_template(client)
    exercises = edit_body(t)["exercises"]
    exercises[1]["id"] = exercises[0]["id"]
    assert put(client, t, exercises=exercises).status_code == 422


def test_other_peoples_workouts_cannot_be_edited_or_deleted(client):
    signup(client, "owner@example.com")
    t = two_exercise_template(client)
    signup(client, "intruder@example.com")
    assert put(client, t, name="Hacked").status_code == 404
    assert client.delete(f"{BASE}/{t['id']}").status_code == 404
    assert client.get(BASE).json() == []


def test_missing_workouts_are_not_found_and_auth_is_required(client):
    signup(client)
    t = two_exercise_template(client)
    missing = str(uuid.uuid4())
    assert client.put(f"{BASE}/{missing}", json=edit_body(t)).status_code == 404
    assert client.delete(f"{BASE}/{missing}").status_code == 404
    client.cookies.clear()
    assert client.put(f"{BASE}/{t['id']}", json=edit_body(t)).status_code == 401
    assert client.delete(f"{BASE}/{t['id']}").status_code == 401


# ---- Deleting ----


def test_a_workout_can_be_deleted(client):
    signup(client)
    keep = make_template(client, "Keep")
    gone = two_exercise_template(client)
    assert client.delete(f"{BASE}/{gone['id']}").status_code == 204
    assert [t["name"] for t in client.get(BASE).json()] == ["Keep"]
    assert client.delete(f"{BASE}/{gone['id']}").status_code == 404
    assert client.get(BASE).json()[0]["id"] == keep["id"]


def test_deleting_a_workout_clears_only_its_days_from_the_plan(client):
    signup(client)
    upper = two_exercise_template(client)["id"]
    lower = make_template(client, "Lower", [exercise("Squats", category="LOWER_BODY")])["id"]
    client.put(
        "/api/v1/workouts/schedule",
        json={
            "days": [
                {"weekday": "MONDAY", "template_id": upper},
                {"weekday": "TUESDAY", "is_rest_day": True},
                {"weekday": "WEDNESDAY", "template_id": lower},
            ]
        },
    )
    client.delete(f"{BASE}/{upper}")
    plan = client.get("/api/v1/workouts/schedule").json()
    assert [(d["weekday"], d["is_rest_day"], d["template_name"]) for d in plan] == [
        ("TUESDAY", True, None),
        ("WEDNESDAY", False, "Lower"),
    ]


def test_deleting_a_workout_keeps_recorded_sessions_with_their_names(client):
    signup(client)
    t = two_exercise_template(client)
    plank = t["exercises"][1]
    sets = [{"exercise_id": plank["id"], "set_number": 1, "duration_seconds": 30}]
    client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=sets))
    client.delete(f"{BASE}/{t['id']}")

    [session] = client.get("/api/v1/workouts/sessions").json()
    assert session["template_name"] == "Upper Body"
    assert session["template_id"] is None
    assert [(s["exercise_name"], s["exercise_id"], s["duration_seconds"]) for s in session["sets"]] == [
        ("Plank", None, 30)
    ]


def test_deleting_or_editing_never_reduces_the_garden(client):
    signup(client)
    t = two_exercise_template(client)
    client.post("/api/v1/workouts/sessions", json=session_body(t["id"]))
    before = client.get("/api/v1/garden").json()["growth_points"]
    assert before > 0
    put(client, t, name="Renamed")
    client.delete(f"{BASE}/{t['id']}")
    assert client.get("/api/v1/garden").json()["growth_points"] == before


def test_a_deleted_workout_cannot_be_recorded_against(client):
    signup(client)
    t = two_exercise_template(client)
    client.delete(f"{BASE}/{t['id']}")
    r = client.post("/api/v1/workouts/sessions", json=session_body(t["id"]))
    assert r.status_code == 404


# ---- History keeps its own names ----


def test_editing_keeps_history_readable(client):
    signup(client)
    t = two_exercise_template(client)
    pushups, plank = t["exercises"]
    sets = [
        {"exercise_id": pushups["id"], "set_number": 1, "repetitions": 12},
        {"exercise_id": plank["id"], "set_number": 1, "duration_seconds": 30},
    ]
    client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=sets))

    # Rename the workout and the plank, and drop the push-ups.
    plank_edit = {**plank, "exercise_name": "Long plank"}
    put(client, t, name="Strength A", exercises=[plank_edit])

    [session] = client.get("/api/v1/workouts/sessions").json()
    assert session["template_name"] == "Upper Body"  # as it was when recorded
    by_name = {s["exercise_name"]: s for s in session["sets"]}
    assert set(by_name) == {"Push-ups", "Plank"}
    assert by_name["Plank"]["exercise_id"] == plank["id"]  # still linked: it was kept
    assert by_name["Push-ups"]["exercise_id"] is None  # removed, but its sets remain


def test_new_sets_record_the_exercise_name(client):
    signup(client)
    t = make_template(client, exercises=[exercise("Plank", "TIME", "CORE")])
    sets = [{"exercise_id": t["exercises"][0]["id"], "set_number": 1, "duration_seconds": 20}]
    body = client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=sets)).json()
    assert body["template_name"] == "Upper Body"
    assert body["sets"][0]["exercise_name"] == "Plank"


def test_a_session_without_a_workout_has_no_name(client):
    signup(client)
    body = client.post("/api/v1/workouts/sessions", json=session_body()).json()
    assert body["template_name"] is None


# ---- Water target ----


def test_water_day_reports_the_two_litre_target(client):
    signup(client)
    day = client.get("/api/v1/water").json()
    assert WATER_TARGET_ML == 2000
    assert (day["total_ml"], day["target_ml"]) == (0, 2000)
    client.post("/api/v1/water", json={"amount_ml": 750})
    day = client.get("/api/v1/water").json()
    assert (day["total_ml"], day["target_ml"]) == (750, 2000)


def test_going_over_the_water_target_is_fine(client):
    signup(client)
    for _ in range(3):
        client.post("/api/v1/water", json={"amount_ml": 1000})
    day = client.get("/api/v1/water").json()
    assert (day["total_ml"], day["target_ml"]) == (3000, 2000)


def test_dashboard_carries_the_water_target(client):
    signup(client)
    client.post(
        "/api/v1/profile",
        json={
            "date_of_birth": "1997-05-14",
            "sex": "FEMALE",
            "height_cm": 165,
            "weight_kg": 52,
            "goal_weight_kg": 58,
            "preferred_unit_system": "METRIC",
            "activity_level": "LIGHT",
            "timezone": "UTC",
        },
    )
    client.post("/api/v1/water", json={"amount_ml": 500})
    today = client.get("/api/v1/dashboard/today").json()
    assert (today["water_ml"], today["water_target_ml"]) == (500, 2000)


@pytest.mark.parametrize("amount", [0, 250])
def test_the_target_does_not_depend_on_what_was_logged(client, amount):
    signup(client)
    client.post("/api/v1/water", json={"amount_ml": amount})
    assert client.get("/api/v1/water").json()["target_ml"] == 2000
