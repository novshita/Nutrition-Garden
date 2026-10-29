import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.services.calculations.workouts import estimate_calories


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct-horse", "display_name": "Rose"},
        ).status_code
        == 201
    )


def exercise(name="Push-ups", type_="REPS", category="UPPER_BODY", **extra):
    base = {"exercise_name": name, "exercise_type": type_, "category": category}
    if type_ in ("REPS", "COMBINED"):
        base["default_reps"] = 12
    if type_ in ("TIME", "COMBINED"):
        base["default_duration_seconds"] = 30
    return {**base, "default_sets": 3, "rest_seconds": 45, **extra}


def make_template(client, name="Upper Body", exercises=None, **extra):
    body = {"name": name, "difficulty": "BEGINNER", "exercises": exercises or [exercise()], **extra}
    r = client.post("/api/v1/workouts/templates", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def iso(dt):
    return dt.isoformat()


def session_body(template_id=None, minutes=60, ended_minutes_ago=5, **extra):
    end = datetime.now(UTC) - timedelta(minutes=ended_minutes_ago)
    body = {"started_at": iso(end - timedelta(minutes=minutes)), "completed_at": iso(end)}
    if template_id:
        body["template_id"] = template_id
    return {**body, **extra}


def log_weight(client, kg):
    assert client.post("/api/v1/weight", json={"weight_kg": kg}).status_code == 201


# Auth ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/workouts/templates"),
        ("post", "/api/v1/workouts/templates"),
        ("get", "/api/v1/workouts/schedule"),
        ("put", "/api/v1/workouts/schedule"),
        ("get", "/api/v1/workouts/sessions"),
        ("post", "/api/v1/workouts/sessions"),
    ],
)
def test_requires_authentication(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# Templates -----------------------------------------------------------------------------


def test_create_and_list_template_keeps_exercise_order(client):
    signup(client)
    made = make_template(
        client,
        exercises=[
            exercise("Push-ups", "REPS"),
            exercise("Plank", "TIME", "CORE"),
            exercise("Burpees", "COMBINED", "HIIT"),
        ],
        description="Home routine",
    )
    assert [e["order_index"] for e in made["exercises"]] == [0, 1, 2]
    listed = client.get("/api/v1/workouts/templates").json()
    assert [t["id"] for t in listed] == [made["id"]]
    assert [e["exercise_name"] for e in listed[0]["exercises"]] == ["Push-ups", "Plank", "Burpees"]
    plank = listed[0]["exercises"][1]
    assert plank["default_duration_seconds"] == 30 and plank["default_reps"] is None


@pytest.mark.parametrize(
    "bad",
    [
        exercise("x", "REPS", default_reps=None),
        exercise("x", "REPS", default_duration_seconds=30),
        exercise("x", "TIME", default_duration_seconds=None),
        exercise("x", "TIME", default_reps=10),
        exercise("x", "COMBINED", default_reps=None),
        exercise("x", "COMBINED", default_duration_seconds=None),
        exercise("x", "REPS", default_reps=0),
        exercise("x", "REPS", default_sets=0),
        exercise("x", "REPS", rest_seconds=-1),
        exercise("", "REPS"),
        exercise("x", "REPS", category="BENCH_PRESS"),
        exercise("x", "SPRINT"),
    ],
)
def test_invalid_exercises_rejected(client, bad):
    signup(client)
    r = client.post(
        "/api/v1/workouts/templates", json={"name": "T", "exercises": [bad]}
    )
    assert r.status_code == 422
    assert client.get("/api/v1/workouts/templates").json() == []


def test_template_needs_name_and_exercises(client):
    signup(client)
    assert client.post("/api/v1/workouts/templates", json={"name": "T", "exercises": []}).status_code == 422
    assert client.post("/api/v1/workouts/templates", json={"name": "", "exercises": [exercise()]}).status_code == 422
    assert (
        client.post(
            "/api/v1/workouts/templates",
            json={"name": "T", "difficulty": "EXPERT", "exercises": [exercise()]},
        ).status_code
        == 422
    )


def test_difficulty_defaults_to_custom(client):
    signup(client)
    r = client.post("/api/v1/workouts/templates", json={"name": "T", "exercises": [exercise()]})
    assert r.json()["difficulty"] == "CUSTOM"


def test_templates_are_private(client):
    signup(client, "a@example.com")
    make_template(client, "Mine")
    signup(client, "b@example.com")
    assert client.get("/api/v1/workouts/templates").json() == []


# Schedule ------------------------------------------------------------------------------


def test_user_routine_can_be_scheduled_and_edited(client):
    signup(client)
    upper = make_template(client, "Upper Body")["id"]
    lower = make_template(client, "Lower Body", [exercise("Squats", category="LOWER_BODY")])["id"]
    plan = [
        {"weekday": "FRIDAY", "template_id": lower},
        {"weekday": "MONDAY", "template_id": upper},
        {"weekday": "TUESDAY", "template_id": upper},
        {"weekday": "WEDNESDAY", "is_rest_day": True},
        {"weekday": "THURSDAY", "template_id": lower},
    ]
    r = client.put("/api/v1/workouts/schedule", json={"days": plan})
    assert r.status_code == 200
    assert [(d["weekday"], d["template_name"], d["is_rest_day"]) for d in r.json()] == [
        ("MONDAY", "Upper Body", False),
        ("TUESDAY", "Upper Body", False),
        ("WEDNESDAY", None, True),
        ("THURSDAY", "Lower Body", False),
        ("FRIDAY", "Lower Body", False),
    ]
    # Editing replaces the plan.
    client.put(
        "/api/v1/workouts/schedule",
        json={"days": [{"weekday": "SATURDAY", "template_id": upper}]},
    )
    assert [d["weekday"] for d in client.get("/api/v1/workouts/schedule").json()] == ["SATURDAY"]
    client.put("/api/v1/workouts/schedule", json={"days": []})
    assert client.get("/api/v1/workouts/schedule").json() == []


@pytest.mark.parametrize(
    "days",
    [
        [{"weekday": "MONDAY"}],  # neither rest nor workout
        [{"weekday": "MONDAY", "is_rest_day": True, "template_id": str(uuid.uuid4())}],
        [{"weekday": "FUNDAY", "is_rest_day": True}],
        [{"weekday": "MONDAY", "is_rest_day": True}, {"weekday": "MONDAY", "is_rest_day": True}],
    ],
)
def test_invalid_schedule_rejected_and_old_plan_kept(client, days):
    signup(client)
    client.put("/api/v1/workouts/schedule", json={"days": [{"weekday": "SUNDAY", "is_rest_day": True}]})
    assert client.put("/api/v1/workouts/schedule", json={"days": days}).status_code == 422
    assert [d["weekday"] for d in client.get("/api/v1/workouts/schedule").json()] == ["SUNDAY"]


def test_cannot_schedule_another_users_template(client):
    signup(client, "a@example.com")
    theirs = make_template(client)["id"]
    signup(client, "b@example.com")
    r = client.put("/api/v1/workouts/schedule", json={"days": [{"weekday": "MONDAY", "template_id": theirs}]})
    assert r.status_code == 404
    assert client.get("/api/v1/workouts/schedule").json() == []


# Sessions ------------------------------------------------------------------------------


def test_session_estimates_calories_from_met_weight_and_duration(client):
    signup(client)
    log_weight(client, 50)
    template = make_template(client)  # UPPER_BODY, MET 3.8
    r = client.post("/api/v1/workouts/sessions", json=session_body(template["id"], minutes=60))
    assert r.status_code == 201
    body = r.json()
    assert body["duration_seconds"] == 3600
    assert body["estimated_calories"] == 190  # 3.8 x 50 kg x 1 h
    assert body["template_name"] == "Upper Body"


def test_calories_average_the_exercises_actually_done(client):
    signup(client)
    log_weight(client, 60)
    t = make_template(
        client,
        exercises=[exercise("Push-ups", category="UPPER_BODY"), exercise("Burpees", "REPS", "HIIT")],
    )
    push, _burpee = t["exercises"]
    sets = [{"exercise_id": push["id"], "set_number": 1, "repetitions": 12}]
    only_push = client.post(
        "/api/v1/workouts/sessions", json=session_body(t["id"], 30, sets=sets)
    ).json()
    assert only_push["estimated_calories"] == round(3.8 * 60 * 0.5)  # 114
    whole = client.post("/api/v1/workouts/sessions", json=session_body(t["id"], 30)).json()
    assert whole["estimated_calories"] == round((3.8 + 8.0) / 2 * 60 * 0.5)  # 177


def test_calories_are_unknown_not_zero_without_weight_or_exercises(client):
    signup(client)
    template = make_template(client)
    no_weight = client.post("/api/v1/workouts/sessions", json=session_body(template["id"])).json()
    assert no_weight["estimated_calories"] is None
    log_weight(client, 50)
    freeform = client.post("/api/v1/workouts/sessions", json=session_body()).json()
    assert freeform["estimated_calories"] is None and freeform["template_id"] is None


def test_sets_are_recorded(client):
    signup(client)
    t = make_template(client, exercises=[exercise("Plank", "TIME", "CORE")])
    plank = t["exercises"][0]["id"]
    sets = [
        {"exercise_id": plank, "set_number": 2, "duration_seconds": 25, "completed": False},
        {"exercise_id": plank, "set_number": 1, "duration_seconds": 30},
    ]
    body = client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=sets)).json()
    assert [(s["set_number"], s["duration_seconds"], s["completed"]) for s in body["sets"]] == [
        (1, 30, True),
        (2, 25, False),
    ]


@pytest.mark.parametrize("minutes_ago_start,minutes_ago_end", [(10, 20), (10, 10)])
def test_completed_must_be_after_started(client, minutes_ago_start, minutes_ago_end):
    signup(client)
    now = datetime.now(UTC)
    body = {
        "started_at": iso(now - timedelta(minutes=minutes_ago_start)),
        "completed_at": iso(now - timedelta(minutes=minutes_ago_end)),
    }
    assert client.post("/api/v1/workouts/sessions", json=body).status_code == 422


def test_invalid_session_times_rejected(client):
    signup(client)
    post = lambda body: client.post("/api/v1/workouts/sessions", json=body).status_code
    assert post(session_body(minutes=361)) == 422  # longer than 6 hours
    future = datetime.now(UTC) + timedelta(hours=3)
    assert post({"started_at": iso(future), "completed_at": iso(future + timedelta(hours=1))}) == 422
    naive = datetime.now(UTC).replace(tzinfo=None)
    assert post({"started_at": naive.isoformat(), "completed_at": naive.isoformat()}) == 422
    assert client.get("/api/v1/workouts/sessions").json() == []


def test_duplicate_set_numbers_and_bad_values_rejected(client):
    signup(client)
    t = make_template(client)
    ex = t["exercises"][0]["id"]
    dup = [{"exercise_id": ex, "set_number": 1}, {"exercise_id": ex, "set_number": 1}]
    assert client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=dup)).status_code == 422
    for bad in ({"set_number": 0}, {"repetitions": -1}, {"duration_seconds": -5}):
        sets = [{"exercise_id": ex, "set_number": 1, **bad}]
        assert client.post("/api/v1/workouts/sessions", json=session_body(t["id"], sets=sets)).status_code == 422


def test_set_must_belong_to_the_workout(client):
    signup(client)
    a = make_template(client, "A")
    b = make_template(client, "B", [exercise("Squats", category="LOWER_BODY")])
    stray = [{"exercise_id": b["exercises"][0]["id"], "set_number": 1}]
    r = client.post("/api/v1/workouts/sessions", json=session_body(a["id"], sets=stray))
    assert r.status_code == 422
    unknown = [{"exercise_id": str(uuid.uuid4()), "set_number": 1}]
    assert client.post("/api/v1/workouts/sessions", json=session_body(sets=unknown)).status_code == 422
    assert client.get("/api/v1/workouts/sessions").json() == []


def test_cannot_use_another_users_template_or_exercise(client):
    signup(client, "a@example.com")
    theirs = make_template(client)
    signup(client, "b@example.com")
    assert client.post("/api/v1/workouts/sessions", json=session_body(theirs["id"])).status_code == 404
    sets = [{"exercise_id": theirs["exercises"][0]["id"], "set_number": 1}]
    assert client.post("/api/v1/workouts/sessions", json=session_body(sets=sets)).status_code == 422
    assert client.get("/api/v1/workouts/sessions").json() == []


def test_list_sessions_newest_first_with_date_filter(client):
    signup(client)
    t = make_template(client)
    for days_ago in (6, 3, 0):
        end = datetime.now(UTC) - timedelta(days=days_ago, minutes=5)
        client.post(
            "/api/v1/workouts/sessions",
            json={"template_id": t["id"], "started_at": iso(end - timedelta(minutes=30)), "completed_at": iso(end)},
        )
    rows = client.get("/api/v1/workouts/sessions").json()
    assert len(rows) == 3
    assert rows[0]["started_at"] > rows[1]["started_at"] > rows[2]["started_at"]
    start = (datetime.now(UTC) - timedelta(days=4)).date().isoformat()
    assert len(client.get("/api/v1/workouts/sessions", params={"start_date": start}).json()) == 2
    assert len(client.get("/api/v1/workouts/sessions", params={"limit": 1}).json()) == 1


def test_sessions_are_private(client):
    signup(client, "a@example.com")
    t = make_template(client)
    client.post("/api/v1/workouts/sessions", json=session_body(t["id"]))
    signup(client, "b@example.com")
    assert client.get("/api/v1/workouts/sessions").json() == []


# Mandatory business-logic test #1 ------------------------------------------------------


def test_workout_calories_cannot_change_the_food_target(client):
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
    before_target = client.get("/api/v1/goals/calorie-target").json()
    before_daily = client.get("/api/v1/nutrition/daily").json()

    t = make_template(client, exercises=[exercise("Burpees", "REPS", "HIIT")])
    done = client.post("/api/v1/workouts/sessions", json=session_body(t["id"], minutes=90)).json()
    assert done["estimated_calories"] > 0

    assert client.get("/api/v1/goals/calorie-target").json() == before_target
    after_daily = client.get("/api/v1/nutrition/daily").json()
    assert after_daily["calorie_target_kcal"] == before_daily["calorie_target_kcal"]
    assert after_daily["calories_remaining"] == before_daily["calories_remaining"]
    assert after_daily["totals"] == before_daily["totals"]


# Calculation ---------------------------------------------------------------------------


def test_estimate_calories_function():
    assert estimate_calories(["UPPER_BODY"], 50, 3600) == 190
    assert estimate_calories(["UPPER_BODY", "HIIT"], 60, 1800) == 177
    assert estimate_calories([], 50, 3600) is None
    assert estimate_calories(["CORE"], None, 3600) is None
    assert estimate_calories(["CORE"], 50, 0) is None
