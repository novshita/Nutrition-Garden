from datetime import UTC, datetime, timedelta

import pytest

PROFILE = {
    "date_of_birth": "2000-01-01",
    "sex": "FEMALE",
    "height_cm": 165,
    "weight_kg": 50,
    "goal_weight_kg": 56,
    "preferred_unit_system": "METRIC",
    "activity_level": "LIGHT",
    "timezone": "Asia/Kolkata",
}


def signup(client, email="rose@example.com"):
    client.cookies.clear()
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse", "display_name": "Rose"},
    )
    assert r.status_code == 201


def log(client, kg, days_ago=0, **extra):
    at = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    return client.post("/api/v1/weight", json={"weight_kg": kg, "recorded_at": at, **extra})


def test_requires_authentication(client):
    assert client.post("/api/v1/weight", json={"weight_kg": 50}).status_code == 401
    assert client.get("/api/v1/weight").status_code == 401
    assert client.get("/api/v1/weight/trend").status_code == 401
    assert client.get("/api/v1/bmi").status_code == 401


def test_log_and_list_weights_oldest_first(client):
    signup(client)
    assert log(client, 51.5, days_ago=2, note="morning").status_code == 201
    assert log(client, 50.0, days_ago=5).status_code == 201
    rows = client.get("/api/v1/weight").json()
    assert [r["weight_kg"] for r in rows] == [50.0, 51.5]
    assert rows[1]["note"] == "morning"


def test_recorded_at_defaults_to_now(client):
    signup(client)
    r = client.post("/api/v1/weight", json={"weight_kg": 50})
    assert r.status_code == 201
    recorded = datetime.fromisoformat(r.json()["recorded_at"])
    assert abs(datetime.now(UTC) - recorded) < timedelta(minutes=1)


@pytest.mark.parametrize(
    "payload",
    [
        {"weight_kg": 0},
        {"weight_kg": -3},
        {"weight_kg": "abc"},
        {"weight_kg": 401},
        {"weight_kg": 50, "recorded_at": "not-a-date"},
        {"weight_kg": 50, "recorded_at": "2026-10-20T08:00:00"},  # no timezone
        {"weight_kg": 50, "note": "x" * 501},
        {},
    ],
)
def test_invalid_weight_rejected(client, payload):
    signup(client)
    assert client.post("/api/v1/weight", json=payload).status_code == 422
    assert client.get("/api/v1/weight").json() == []


def test_future_timestamp_rejected(client):
    signup(client)
    future = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    assert client.post("/api/v1/weight", json={"weight_kg": 50, "recorded_at": future}).status_code == 422


def test_list_filters_by_local_date_range(client):
    signup(client)
    for days, kg in [(10, 50.0), (5, 51.0), (1, 52.0)]:
        log(client, kg, days_ago=days)
    start = (datetime.now(UTC) - timedelta(days=6)).date().isoformat()
    rows = client.get("/api/v1/weight", params={"start_date": start}).json()
    assert [r["weight_kg"] for r in rows] == [51.0, 52.0]
    assert len(client.get("/api/v1/weight", params={"limit": 1}).json()) == 1


def test_trend_with_single_measurement_is_insufficient(client):
    signup(client)
    log(client, 50.0)
    trend = client.get("/api/v1/weight/trend").json()
    assert trend["state"] == "INSUFFICIENT_DATA"
    assert trend["weekly_change_kg"] is None


def test_trend_increasing_and_series(client):
    signup(client)
    for d in (13, 11, 9):
        log(client, 50.0, days_ago=d)
    for d in (5, 3, 1):
        log(client, 50.3, days_ago=d)
    trend = client.get("/api/v1/weight/trend").json()
    assert trend["state"] == "INCREASING"
    assert trend["weekly_change_kg"] == pytest.approx(0.3, abs=0.01)
    assert len(trend["series"]) == 6
    assert trend["series"][-1]["average_kg"] == pytest.approx(50.3, abs=0.01)


def test_weights_are_private_per_user(client):
    signup(client, "a@example.com")
    log(client, 50.0)
    signup(client, "b@example.com")
    assert client.get("/api/v1/weight").json() == []
    assert client.get("/api/v1/weight/trend").json()["days_with_data"] == 0


def test_bmi_uses_latest_weight_and_height(client):
    signup(client)
    assert client.get("/api/v1/bmi").status_code == 404
    client.post("/api/v1/profile", json=PROFILE)
    log(client, 60.0)  # newer than the onboarding weight
    body = client.get("/api/v1/bmi").json()
    assert body["weight_kg"] == 60.0
    assert body["bmi"] == pytest.approx(22.0, abs=0.05)
    assert "category" not in body
