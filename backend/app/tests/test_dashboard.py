from datetime import UTC, datetime, timedelta

import pytest

TODAY = datetime.now(UTC).date()


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
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "correct-horse"}
    ).status_code == 200


def onboard(client, tz="UTC", weight=50):
    assert (
        client.post(
            "/api/v1/profile",
            json={
                "date_of_birth": "2000-01-01",
                "sex": "FEMALE",
                "height_cm": 165,
                "weight_kg": weight,
                "goal_weight_kg": 58,
                "preferred_unit_system": "METRIC",
                "activity_level": "LIGHT",
                "timezone": tz,
            },
        ).status_code
        == 201
    )


def eat(client, calories, at=None, **extra):
    body = {
        "meal_type": "LUNCH",
        "items": [
            {"food_source": "CUSTOM", "food_name": "Meal", "quantity": 1, "unit": "plate", "calories": calories, **extra}
        ],
    }
    if at:
        body["consumed_at"] = at
    assert client.post("/api/v1/food/log", json=body).status_code == 201


def make_template(client, name="Upper Body"):
    return client.post(
        "/api/v1/workouts/templates",
        json={
            "name": name,
            "exercises": [
                {"exercise_name": "Push-ups", "exercise_type": "REPS", "category": "UPPER_BODY", "default_reps": 10}
            ],
        },
    ).json()


def session(client, template_id, start, minutes=30):
    end = start + timedelta(minutes=minutes)
    assert (
        client.post(
            "/api/v1/workouts/sessions",
            json={"template_id": template_id, "started_at": start.isoformat(), "completed_at": end.isoformat()},
        ).status_code
        == 201
    )


# Auth ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/dashboard/today",
        "/api/v1/calendar?start_date=2026-01-01&end_date=2026-01-07",
        "/api/v1/calendar/2026-01-01",
    ],
)
def test_requires_authentication(client, path):
    assert client.get(path).status_code == 401


# Dashboard -----------------------------------------------------------------------------


def test_empty_day_is_calm_not_alarming(client):
    signup(client)
    d = client.get("/api/v1/dashboard/today").json()
    assert d["date"] == TODAY.isoformat()
    assert d["calories"] == {"consumed": None, "target": None, "remaining": None}
    assert d["protein"] == {"consumed_g": None, "target_g": None}
    assert d["water_ml"] == 0
    assert d["sleep_minutes"] is None and d["steps"] is None
    assert d["mood"] is None and d["weight_kg"] is None
    assert d["workout"] == {"planned": None, "completed": []}
    assert d["garden"]["growth_points"] == 0 and d["garden"]["actions"] == []
    assert d["garden"]["growth_stage"] == 1 and d["garden"]["bunny_stage"] == 1


def test_dashboard_brings_every_tracker_together(client):
    signup(client)
    onboard(client)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2000})
    eat(client, 600, protein_g=30)
    eat(client, 400)
    client.post("/api/v1/water", json={"amount_ml": 250})
    client.post("/api/v1/water", json={"amount_ml": 500})
    day = TODAY.isoformat()
    client.put(f"/api/v1/sleep/{day}", json={"duration_minutes": 450})
    client.put(f"/api/v1/activity/{day}", json={"steps": 2500})
    client.put(f"/api/v1/mood/{day}", json={"mood": "GOOD"})
    client.post("/api/v1/weight", json={"weight_kg": 51.2})
    template = make_template(client)
    weekday = TODAY.strftime("%A").upper()
    client.put(
        "/api/v1/workouts/schedule", json={"days": [{"weekday": weekday, "template_id": template["id"]}]}
    )
    session(client, template["id"], datetime.now(UTC) - timedelta(hours=2))

    d = client.get("/api/v1/dashboard/today").json()
    assert d["calories"] == {"consumed": 1000, "target": 2000, "remaining": 1000}
    assert d["protein"] == {"consumed_g": 30, "target_g": None}
    assert d["nutrition"]["items_logged"] == 2
    assert d["nutrition"]["items_missing"]["protein_g"] == 1  # honest about what's unknown
    assert (d["water_ml"], d["sleep_minutes"], d["steps"], d["mood"]) == (750, 450, 2500, "GOOD")
    assert d["weight_kg"] == 51.2  # today's weigh-in, not the onboarding one
    assert d["workout"]["planned"]["template_name"] == "Upper Body"
    assert d["workout"]["planned"]["is_rest_day"] is False
    [done] = d["workout"]["completed"]
    assert done["template_name"] == "Upper Body" and done["duration_seconds"] == 1800
    assert done["estimated_calories"] is not None
    assert d["garden"]["points_earned"] == len(d["garden"]["actions"]) == 8 - 1  # no target met yet
    assert d["garden"]["growth_points"] == d["garden"]["points_earned"]


def test_remaining_calories_never_negative(client):
    signup(client)
    onboard(client)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 1500})
    eat(client, 2200)
    d = client.get("/api/v1/dashboard/today").json()
    assert d["calories"] == {"consumed": 2200, "target": 1500, "remaining": 0}


def test_rest_day_is_shown_as_planned(client):
    signup(client)
    client.put(
        "/api/v1/workouts/schedule",
        json={"days": [{"weekday": TODAY.strftime("%A").upper(), "is_rest_day": True}]},
    )
    planned = client.get("/api/v1/dashboard/today").json()["workout"]["planned"]
    assert planned["is_rest_day"] is True and planned["template_name"] is None


def test_dashboard_uses_users_local_today(client):
    signup(client)
    onboard(client, tz="Pacific/Kiritimati")  # UTC+14, a different date than UTC for 14 hours a day
    from zoneinfo import ZoneInfo

    local_today = datetime.now(ZoneInfo("Pacific/Kiritimati")).date()
    assert client.get("/api/v1/dashboard/today").json()["date"] == local_today.isoformat()


def test_dashboard_is_private_per_user(client):
    signup(client, "a@example.com")
    client.post("/api/v1/water", json={"amount_ml": 900})
    eat(client, 500)
    signup(client, "b@example.com")
    d = client.get("/api/v1/dashboard/today").json()
    assert d["water_ml"] == 0 and d["calories"]["consumed"] is None
    login(client, "a@example.com")
    assert client.get("/api/v1/dashboard/today").json()["water_ml"] == 900


def test_dashboard_matches_the_individual_trackers(client):
    signup(client)
    onboard(client)
    eat(client, 350)
    client.post("/api/v1/water", json={"amount_ml": 400})
    d = client.get("/api/v1/dashboard/today").json()
    assert d["nutrition"] == client.get("/api/v1/nutrition/daily").json()["totals"]
    assert d["water_ml"] == client.get("/api/v1/water").json()["total_ml"]
    g = client.get("/api/v1/garden").json()
    assert (d["garden"]["growth_points"], d["garden"]["growth_stage"]) == (g["growth_points"], g["growth_stage"])


# Calendar ------------------------------------------------------------------------------

D1, D2, D3 = "2026-03-09", "2026-03-10", "2026-03-11"  # Mon, Tue, Wed


def noon(day):
    return f"{day}T12:00:00+00:00"


def seed_week(client):
    signup(client)
    onboard(client, weight=50)  # weight logged "today", outside the calendar range
    client.post("/api/v1/water", json={"amount_ml": 300, "consumed_at": noon(D1)})
    client.post("/api/v1/water", json={"amount_ml": 200, "consumed_at": noon(D1)})
    eat(client, 500, at=noon(D1))
    eat(client, 250, at=noon(D1))
    client.post("/api/v1/weight", json={"weight_kg": 50.5, "recorded_at": f"{D2}T07:00:00+00:00"})
    client.post("/api/v1/weight", json={"weight_kg": 51.0, "recorded_at": f"{D2}T20:00:00+00:00"})
    client.put(f"/api/v1/sleep/{D2}", json={"duration_minutes": 420})
    client.put(f"/api/v1/mood/{D2}", json={"mood": "OKAY"})
    client.put(f"/api/v1/activity/{D2}", json={"steps": 4000})
    template = make_template(client)
    client.put(
        "/api/v1/workouts/schedule",
        json={
            "days": [
                {"weekday": "MONDAY", "template_id": template["id"]},
                {"weekday": "WEDNESDAY", "is_rest_day": True},
            ]
        },
    )
    session(client, template["id"], datetime(2026, 3, 9, 8, 0, tzinfo=UTC))
    session(client, template["id"], datetime(2026, 3, 9, 18, 0, tzinfo=UTC))


def calendar(client, start=D1, end=D3):
    r = client.get("/api/v1/calendar", params={"start_date": start, "end_date": end})
    assert r.status_code == 200, r.text
    return {row["date"]: row for row in r.json()}


def test_calendar_has_a_row_for_every_day_with_aggregated_data(client):
    seed_week(client)
    days = calendar(client)
    assert list(days) == [D1, D2, D3]

    monday = days[D1]
    assert (monday["water_ml"], monday["calories"], monday["food_items_logged"]) == (500, 750, 2)
    assert monday["workouts_completed"] == 2
    assert monday["planned_workout"] == {"is_rest_day": False, "template_name": "Upper Body"}
    assert monday["has_activity"] is True and monday["weight_kg"] is None

    tuesday = days[D2]
    assert tuesday["weight_kg"] == 51.0  # last weigh-in of the day
    assert (tuesday["sleep_minutes"], tuesday["mood"], tuesday["steps"]) == (420, "OKAY", 4000)
    assert tuesday["planned_workout"] is None and tuesday["workouts_completed"] == 0

    wednesday = days[D3]
    assert wednesday["has_activity"] is False
    assert wednesday["planned_workout"] == {"is_rest_day": True, "template_name": None}
    assert wednesday["calories"] is None and wednesday["water_ml"] == 0


def test_calendar_day_detail_matches_the_calendar_row(client):
    seed_week(client)
    days = calendar(client)
    for day in (D1, D2, D3):
        detail = client.get(f"/api/v1/calendar/{day}").json()
        row = days[day]
        assert detail["date"] == day
        assert detail["water_ml"] == row["water_ml"]
        assert detail["calories"]["consumed"] == row["calories"]
        assert detail["sleep_minutes"] == row["sleep_minutes"]
        assert detail["steps"] == row["steps"] and detail["mood"] == row["mood"]
        assert detail["weight_kg"] == row["weight_kg"]
        assert len(detail["workout"]["completed"]) == row["workouts_completed"]
        assert detail["nutrition"]["items_logged"] == row["food_items_logged"]


def test_calendar_day_detail_for_a_past_day_shows_that_days_growth(client):
    seed_week(client)
    monday = client.get(f"/api/v1/calendar/{D1}").json()
    assert set(monday["garden"]["actions"]) == {"WATER_LOGGED", "FOOD_LOGGED", "WORKOUT_COMPLETED"}
    assert monday["garden"]["points_earned"] == 3
    empty = client.get(f"/api/v1/calendar/{D3}").json()
    assert empty["garden"]["points_earned"] == 0
    assert empty["garden"]["growth_points"] == monday["garden"]["growth_points"]  # overall, never lower


def test_calendar_follows_the_users_timezone(client):
    signup(client)
    onboard(client, tz="Pacific/Kiritimati")  # UTC+14
    # 11:00 UTC on the 10th is 01:00 on the 11th for this user.
    client.post("/api/v1/water", json={"amount_ml": 400, "consumed_at": "2026-03-10T11:00:00+00:00"})
    days = calendar(client, D2, D3)
    assert days[D2]["water_ml"] == 0 and days[D3]["water_ml"] == 400


def test_calendar_single_day_and_full_allowed_range(client):
    signup(client)
    assert len(calendar(client, D1, D1)) == 1
    start = datetime(2026, 1, 1).date()
    end = start + timedelta(days=61)
    assert len(calendar(client, start.isoformat(), end.isoformat())) == 62


@pytest.mark.parametrize(
    "start,end",
    [("2026-03-11", "2026-03-09"), ("2026-01-01", "2026-03-10"), ("nope", "2026-03-10")],
)
def test_invalid_calendar_ranges_rejected(client, start, end):
    signup(client)
    r = client.get("/api/v1/calendar", params={"start_date": start, "end_date": end})
    assert r.status_code == 422


def test_calendar_requires_both_dates(client):
    signup(client)
    assert client.get("/api/v1/calendar", params={"start_date": D1}).status_code == 422


def test_calendar_is_private_per_user(client):
    seed_week(client)
    signup(client, "b@example.com")
    days = calendar(client)
    assert all(not row["has_activity"] for row in days.values())
    assert all(row["planned_workout"] is None for row in days.values())
    login(client, "rose@example.com")
    assert calendar(client)[D1]["water_ml"] == 500
