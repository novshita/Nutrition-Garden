from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.models import CalorieTarget


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


def onboard(client, weight=50):
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
                "timezone": "UTC",
            },
        ).status_code
        == 201
    )


def log_weights(client, days=28, slope_per_day=0.0, base=50.0):
    """One weigh-in per day for the last `days` days (not including today)."""
    now = datetime.now(UTC).replace(hour=12, minute=0, second=0, microsecond=0)
    for i in range(days, 0, -1):
        r = client.post(
            "/api/v1/weight",
            json={
                "weight_kg": round(base + slope_per_day * (days - i), 3),
                "recorded_at": (now - timedelta(days=i)).isoformat(),
            },
        )
        assert r.status_code == 201


def backdate_target(db, days=40):
    db.execute(update(CalorieTarget).values(effective_from=datetime.now(UTC) - timedelta(days=days)))
    db.flush()


def suggestion(client):
    r = client.get("/api/v1/goals/calorie-target/suggestion")
    assert r.status_code == 200, r.text
    return r.json()


def history(client):
    return client.get("/api/v1/goals/calorie-target").json()


# Auth and onboarding -------------------------------------------------------------------


def test_requires_authentication(client):
    assert client.get("/api/v1/goals/calorie-target/suggestion").status_code == 401
    r = client.post("/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": 2000})
    assert r.status_code == 401


def test_needs_onboarding_first(client):
    signup(client)
    assert client.get("/api/v1/goals/calorie-target/suggestion").status_code == 409
    r = client.post("/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": 2000})
    assert r.status_code == 409


# Mandatory business-logic test #7 ------------------------------------------------------


def test_insufficient_weight_data_cannot_trigger_a_calorie_adjustment(client, db):
    signup(client)
    onboard(client)
    s = suggestion(client)
    assert s["status"] == "INSUFFICIENT_DATA"
    assert s["suggested_target_kcal"] is None and s["reason"] is None
    assert s["days_until_evaluation"] == 21 - 1  # the target is brand new
    before = history(client)

    # Even with a few weigh-ins and an old target, one thin week is not enough.
    backdate_target(db)
    log_weights(client, days=5)
    assert suggestion(client)["status"] == "INSUFFICIENT_DATA"
    r = client.post(
        "/api/v1/goals/calorie-target/suggestion/accept",
        json={"target_kcal": before["current"]["target_kcal"] + 100},
    )
    assert r.status_code == 409
    after = history(client)
    assert [t["target_kcal"] for t in after["history"]] == [t["target_kcal"] for t in before["history"]]


# Suggestions ---------------------------------------------------------------------------


def test_stable_weight_suggests_plus_100_but_never_applies_it(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28, slope_per_day=0.0)
    backdate_target(db)
    before = history(client)

    s = suggestion(client)
    current = before["current"]["target_kcal"]
    assert s["status"] == "REVIEW_SUGGESTED" and s["reason"] == "STABLE_WEIGHT"
    assert s["trend_state"] == "STABLE"
    assert s["current_target_kcal"] == current
    assert s["suggested_target_kcal"] == current + 100
    assert s["weekly_change_kg"] == pytest.approx(0.0, abs=0.05)
    assert s["days_until_evaluation"] is None

    # Reading the suggestion (as many times as you like) changes nothing.
    for _ in range(3):
        suggestion(client)
    assert history(client) == before


def test_accepting_applies_the_suggestion_with_history_and_resets_the_clock(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28)
    backdate_target(db)
    current = history(client)["current"]["target_kcal"]

    r = client.post(
        "/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": current + 100}
    )
    assert r.status_code == 200
    assert r.json()["target_kcal"] == current + 100
    assert r.json()["source"] == "ACCEPTED_SUGGESTION"
    assert "STABLE_WEIGHT" in r.json()["reason"]

    h = history(client)
    assert h["current"]["target_kcal"] == current + 100
    assert [t["target_kcal"] for t in h["history"]] == [current + 100, current]  # nothing overwritten
    assert h["history"][1]["effective_until"] is not None
    assert client.get("/api/v1/profile").json()["calorie_target_kcal"] == current + 100

    # The new target needs three fresh weeks of data before it can be judged.
    again = suggestion(client)
    assert again["status"] == "INSUFFICIENT_DATA"
    assert again["suggested_target_kcal"] is None
    rerun = client.post(
        "/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": current + 200}
    )
    assert rerun.status_code == 409


def test_accept_must_match_the_current_suggestion(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28)
    backdate_target(db)
    current = history(client)["current"]["target_kcal"]
    for wrong in (current, current + 50, current + 500, 1):
        r = client.post("/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": wrong})
        assert r.status_code == 409
    assert history(client)["current"]["target_kcal"] == current


def test_gaining_too_fast_recommends_review_without_a_number(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28, slope_per_day=0.7 / 7)
    backdate_target(db)
    s = suggestion(client)
    assert s["status"] == "REVIEW_SUGGESTED" and s["reason"] == "WEIGHT_RISING_FAST"
    assert s["trend_state"] == "INCREASING_FAST"
    assert s["suggested_target_kcal"] is None
    r = client.post("/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": 2000})
    assert r.status_code == 409


def test_steady_progress_and_weight_loss_get_no_suggestion(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28, slope_per_day=0.3 / 7)
    backdate_target(db)
    on_track = suggestion(client)
    assert on_track["status"] == "NO_CHANGE_SUGGESTED" and on_track["trend_state"] == "INCREASING"

    signup(client, "b@example.com")
    onboard(client)
    log_weights(client, days=28, slope_per_day=-0.3 / 7)
    backdate_target(db)
    losing = suggestion(client)
    assert losing["status"] == "NO_CHANGE_SUGGESTED"
    assert losing["trend_state"] == "DECREASING" and losing["suggested_target_kcal"] is None


def test_a_manual_target_change_also_resets_the_evaluation(client, db):
    signup(client)
    onboard(client)
    log_weights(client, days=28)
    backdate_target(db)
    assert suggestion(client)["status"] == "REVIEW_SUGGESTED"
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2300, "reason": "my choice"})
    s = suggestion(client)
    assert s["status"] == "INSUFFICIENT_DATA" and s["days_until_evaluation"] == 20


def test_users_get_their_own_suggestion_and_cannot_accept_for_others(client, db):
    signup(client, "a@example.com")
    onboard(client)
    log_weights(client, days=28)
    backdate_target(db)
    a_target = history(client)["current"]["target_kcal"]
    signup(client, "b@example.com")
    onboard(client)  # no history yet
    assert suggestion(client)["status"] == "INSUFFICIENT_DATA"
    r = client.post(
        "/api/v1/goals/calorie-target/suggestion/accept", json={"target_kcal": a_target + 100}
    )
    assert r.status_code == 409
    login(client, "a@example.com")
    assert suggestion(client)["status"] == "REVIEW_SUGGESTED"
    assert len(db.scalars(select(CalorieTarget).where(CalorieTarget.target_kcal == a_target + 100)).all()) == 0
