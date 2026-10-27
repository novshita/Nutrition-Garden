import pytest
from sqlalchemy import select

from app.models import CalorieTarget, WeightLog

PROFILE = {
    "date_of_birth": "2000-01-01",
    "sex": "FEMALE",
    "height_cm": 165,
    "weight_kg": 50,
    "goal_weight_kg": 56,
    "preferred_unit_system": "IMPERIAL",
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


def onboard(client, **overrides):
    return client.post("/api/v1/profile", json={**PROFILE, **overrides})


def test_requires_authentication(client):
    assert client.post("/api/v1/profile", json=PROFILE).status_code == 401
    assert client.get("/api/v1/profile").status_code == 401
    assert client.get("/api/v1/goals/calorie-target").status_code == 401


def test_onboarding_computes_metrics_and_stores_everything(client, db):
    signup(client)
    r = onboard(client)
    assert r.status_code == 201
    body = r.json()
    assert body["profile"]["preferred_unit_system"] == "IMPERIAL"
    assert body["profile"]["goal_type"] == "GAIN_WEIGHT"
    assert body["current_weight_kg"] == 50
    assert body["bmi"] == pytest.approx(18.4, abs=0.05)
    # Plausibility: BMR/TDEE/target relationship is exact, absolute values depend on age today.
    assert body["tdee_kcal"] == pytest.approx(body["bmr_kcal"] * 1.375, abs=0.2)
    assert body["calorie_target_kcal"] == round(body["tdee_kcal"] + 250)

    assert float(db.scalar(select(WeightLog.weight_kg))) == 50
    target = db.scalar(select(CalorieTarget))
    assert target.target_kcal == body["calorie_target_kcal"]
    assert target.source.value == "INITIAL_ESTIMATE"
    assert target.effective_until is None


def test_get_profile_returns_same_summary(client):
    signup(client)
    created = onboard(client).json()
    assert client.get("/api/v1/profile").json() == created


def test_get_profile_404_before_onboarding(client):
    signup(client)
    assert client.get("/api/v1/profile").status_code == 404


def test_second_onboarding_conflicts(client):
    signup(client)
    assert onboard(client).status_code == 201
    assert onboard(client).status_code == 409


@pytest.mark.parametrize(
    "override",
    [
        {"height_cm": 0},
        {"weight_kg": -5},
        {"goal_weight_kg": 0},
        {"sex": "OTHER"},
        {"activity_level": "LAZY"},
        {"timezone": "Mars/Olympus"},
        {"date_of_birth": "2999-01-01"},
        {"date_of_birth": "2020-01-01"},
        {"weight_kg": "heavy"},
    ],
)
def test_invalid_onboarding_rejected(client, db, override):
    signup(client)
    assert onboard(client, **override).status_code == 422
    assert db.scalar(select(CalorieTarget)) is None


def test_adjusting_target_keeps_history(client, db):
    signup(client)
    initial = onboard(client).json()["calorie_target_kcal"]
    r = client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2400, "reason": "Felt right"})
    assert r.status_code == 200
    assert r.json()["source"] == "USER_ADJUSTED"

    data = client.get("/api/v1/goals/calorie-target").json()
    assert data["current"]["target_kcal"] == 2400
    assert [t["target_kcal"] for t in data["history"]] == [2400, initial]
    old = data["history"][1]
    assert old["effective_until"] is not None
    assert old["effective_until"] == data["current"]["effective_from"]
    # Profile summary reflects the adjusted target.
    assert client.get("/api/v1/profile").json()["calorie_target_kcal"] == 2400


@pytest.mark.parametrize("kcal", [0, 1199, 6001, -100])
def test_target_bounds_enforced(client, kcal):
    signup(client)
    onboard(client)
    assert client.put("/api/v1/goals/calorie-target", json={"target_kcal": kcal}).status_code == 422


def test_cannot_adjust_target_before_onboarding(client):
    signup(client)
    assert client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2200}).status_code == 409


def test_users_cannot_see_each_others_data(client):
    signup(client, "a@example.com")
    onboard(client, weight_kg=50)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2300})

    signup(client, "b@example.com")
    assert client.get("/api/v1/profile").status_code == 404
    assert client.get("/api/v1/goals/calorie-target").json() == {"current": None, "history": []}
    onboard(client, weight_kg=70)
    assert client.get("/api/v1/profile").json()["current_weight_kg"] == 70
    history = client.get("/api/v1/goals/calorie-target").json()["history"]
    assert len(history) == 1
