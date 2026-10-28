from datetime import UTC, datetime, timedelta

import pytest

from app.services.calculations.sleep import duration_minutes


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse", "display_name": "Rose"},
    )
    assert r.status_code == 201


def today():
    return datetime.now(UTC).date()


def day(offset=0):
    return (today() - timedelta(days=offset)).isoformat()


# Auth ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("post", "/api/v1/water"),
        ("get", "/api/v1/water"),
        ("put", "/api/v1/activity/2026-01-01"),
        ("get", "/api/v1/activity"),
        ("put", "/api/v1/mood/2026-01-01"),
        ("get", "/api/v1/mood"),
        ("put", "/api/v1/sleep/2026-01-01"),
        ("get", "/api/v1/sleep"),
    ],
)
def test_requires_authentication(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# Water ---------------------------------------------------------------------------------


def test_water_entries_and_daily_total(client):
    signup(client)
    for ml in (250, 500):
        assert client.post("/api/v1/water", json={"amount_ml": ml}).status_code == 201
    body = client.get("/api/v1/water").json()
    assert body["date"] == day()
    assert body["total_ml"] == 750
    assert [e["amount_ml"] for e in body["entries"]] == [250, 500]


def test_water_total_is_per_day(client):
    signup(client)
    yesterday_noon = (datetime.now(UTC) - timedelta(days=1)).replace(hour=12).isoformat()
    client.post("/api/v1/water", json={"amount_ml": 300, "consumed_at": yesterday_noon})
    client.post("/api/v1/water", json={"amount_ml": 200})
    assert client.get("/api/v1/water", params={"day": day(1)}).json()["total_ml"] == 300
    assert client.get("/api/v1/water", params={"day": day(0)}).json()["total_ml"] == 200
    assert client.get("/api/v1/water", params={"day": day(5)}).json()["total_ml"] == 0


def test_water_day_uses_user_timezone(client):
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
    # 11:00 UTC on 2026-03-10 is 01:00 on 2026-03-11 in Kiritimati.
    client.post(
        "/api/v1/water",
        json={"amount_ml": 400, "consumed_at": "2026-03-10T11:00:00+00:00"},
    )
    assert client.get("/api/v1/water", params={"day": "2026-03-11"}).json()["total_ml"] == 400
    assert client.get("/api/v1/water", params={"day": "2026-03-10"}).json()["total_ml"] == 0


@pytest.mark.parametrize(
    "payload",
    [
        {"amount_ml": -1},
        {"amount_ml": "lots"},
        {"amount_ml": 5001},
        {"amount_ml": 1.5},
        {"amount_ml": 250, "consumed_at": "2026-01-01T10:00:00"},
        {},
    ],
)
def test_invalid_water_rejected(client, payload):
    signup(client)
    assert client.post("/api/v1/water", json=payload).status_code == 422
    assert client.get("/api/v1/water").json()["total_ml"] == 0


def test_future_water_rejected(client):
    signup(client)
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    r = client.post("/api/v1/water", json={"amount_ml": 250, "consumed_at": future})
    assert r.status_code == 422


# Steps ---------------------------------------------------------------------------------


def test_steps_upsert_replaces_value(client):
    signup(client)
    assert client.put(f"/api/v1/activity/{day()}", json={"steps": 2500}).json()["steps"] == 2500
    assert client.put(f"/api/v1/activity/{day()}", json={"steps": 4000}).status_code == 200
    assert client.get(f"/api/v1/activity/{day()}").json()["steps"] == 4000
    assert len(client.get("/api/v1/activity").json()) == 1


def test_steps_zero_allowed_negative_rejected(client):
    signup(client)
    assert client.put(f"/api/v1/activity/{day()}", json={"steps": 0}).status_code == 200
    for bad in (-1, 1_000_000, "many", None):
        assert client.put(f"/api/v1/activity/{day()}", json={"steps": bad}).status_code == 422


def test_steps_404_when_missing_and_future_rejected(client):
    signup(client)
    assert client.get(f"/api/v1/activity/{day(3)}").status_code == 404
    future = (today() + timedelta(days=2)).isoformat()
    assert client.put(f"/api/v1/activity/{future}", json={"steps": 10}).status_code == 422
    assert client.put("/api/v1/activity/not-a-date", json={"steps": 10}).status_code == 422


def test_steps_range_listing(client):
    signup(client)
    for offset, steps in [(0, 3000), (2, 5000), (6, 7000)]:
        client.put(f"/api/v1/activity/{day(offset)}", json={"steps": steps})
    rows = client.get("/api/v1/activity", params={"start_date": day(3)}).json()
    assert [r["steps"] for r in rows] == [5000, 3000]  # oldest first


# Mood ----------------------------------------------------------------------------------


def test_mood_upsert_and_note(client):
    signup(client)
    client.put(f"/api/v1/mood/{day()}", json={"mood": "GOOD", "note": "sunny walk"})
    client.put(f"/api/v1/mood/{day()}", json={"mood": "LOW"})
    body = client.get(f"/api/v1/mood/{day()}").json()
    assert body == {"date": day(), "mood": "LOW", "note": None}
    assert len(client.get("/api/v1/mood").json()) == 1


@pytest.mark.parametrize("mood", ["HAPPY", "great", "", None, 3])
def test_invalid_mood_rejected(client, mood):
    signup(client)
    assert client.put(f"/api/v1/mood/{day()}", json={"mood": mood}).status_code == 422


# Sleep ---------------------------------------------------------------------------------


def test_sleep_duration_calculated_from_times(client):
    signup(client)
    r = client.put(
        f"/api/v1/sleep/{day()}",
        json={
            "bedtime": "2026-03-10T22:30:00+00:00",
            "wake_time": "2026-03-11T06:45:00+00:00",
            "quality": 4,
            "notes": "woke once",
        },
    )
    assert r.status_code == 200
    assert r.json()["duration_minutes"] == 495
    assert r.json()["quality"] == 4


def test_sleep_ignores_client_duration_when_times_given(client):
    signup(client)
    r = client.put(
        f"/api/v1/sleep/{day()}",
        json={
            "bedtime": "2026-03-10T23:00:00+00:00",
            "wake_time": "2026-03-11T07:00:00+00:00",
            "duration_minutes": 10,
        },
    )
    assert r.json()["duration_minutes"] == 480


def test_sleep_with_duration_only_and_upsert(client):
    signup(client)
    client.put(f"/api/v1/sleep/{day()}", json={"duration_minutes": 420})
    client.put(f"/api/v1/sleep/{day()}", json={"duration_minutes": 450, "quality": 3})
    body = client.get(f"/api/v1/sleep/{day()}").json()
    assert body["duration_minutes"] == 450 and body["bedtime"] is None
    assert len(client.get("/api/v1/sleep").json()) == 1


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"duration_minutes": 0},
        {"duration_minutes": -5},
        {"duration_minutes": 1441},
        {"duration_minutes": 400, "quality": 0},
        {"duration_minutes": 400, "quality": 6},
        {"bedtime": "2026-03-10T22:00:00+00:00"},
        {"bedtime": "2026-03-11T06:00:00+00:00", "wake_time": "2026-03-10T22:00:00+00:00"},
        {"bedtime": "2026-03-01T06:00:00+00:00", "wake_time": "2026-03-10T22:00:00+00:00"},
        {"bedtime": "2026-03-10T22:00:00", "wake_time": "2026-03-11T06:00:00"},
    ],
)
def test_invalid_sleep_rejected(client, payload):
    signup(client)
    assert client.put(f"/api/v1/sleep/{day()}", json=payload).status_code == 422
    assert client.get("/api/v1/sleep").json() == []


def test_sleep_duration_function():
    start = datetime(2026, 3, 10, 22, 0, tzinfo=UTC)
    assert duration_minutes(start, start + timedelta(hours=8)) == 480
    with pytest.raises(ValueError):
        duration_minutes(start, start)


# Privacy -------------------------------------------------------------------------------


def test_users_cannot_see_each_others_daily_data(client):
    signup(client, "a@example.com")
    client.post("/api/v1/water", json={"amount_ml": 500})
    client.put(f"/api/v1/activity/{day()}", json={"steps": 9000})
    client.put(f"/api/v1/mood/{day()}", json={"mood": "GREAT"})
    client.put(f"/api/v1/sleep/{day()}", json={"duration_minutes": 480})

    signup(client, "b@example.com")
    assert client.get("/api/v1/water").json()["total_ml"] == 0
    assert client.get(f"/api/v1/activity/{day()}").status_code == 404
    assert client.get(f"/api/v1/mood/{day()}").status_code == 404
    assert client.get(f"/api/v1/sleep/{day()}").status_code == 404
    # B writing the same date must not touch A's rows.
    client.put(f"/api/v1/activity/{day()}", json={"steps": 100})
    signup_back = client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "correct-horse"}
    )
    assert signup_back.status_code == 200
    assert client.get(f"/api/v1/activity/{day()}").json()["steps"] == 9000
