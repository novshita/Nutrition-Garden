import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.api.deps import get_now
from app.config import LOGIN_FAILURE_WINDOW_MINUTES, LOGIN_MAX_FAILURES, SESSION_COOKIE_NAME
from app.db.base import Base
from app.enums import MemoryCategory, MemoryStatus, NudgeKind
from app.models import AiMemory, AiUsage, AuthSession, FairyNudge, User
from app.tests.test_account_security import Clock
from app.tests.test_dashboard import onboard

URL = "/api/v1/auth/delete-account"
PASSWORD = "correct-horse"


def register(client, email="rose@example.com"):
    client.cookies.clear()
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": "Rose"},
    )
    assert r.status_code == 201
    return uuid.UUID(r.json()["id"])


def delete(client, password=PASSWORD):
    return client.post(URL, json={"password": password})


def fill_account(client, db, user_id):
    """Put something in every part of the app a person can use."""
    onboard(client)
    end = datetime.now(UTC) - timedelta(minutes=5)
    client.post("/api/v1/weight", json={"weight_kg": 51})
    client.post("/api/v1/water", json={"amount_ml": 500})
    day = datetime.now(UTC).date().isoformat()
    client.put(f"/api/v1/sleep/{day}", json={"duration_minutes": 480})
    client.put(f"/api/v1/mood/{day}", json={"mood": "GOOD"})
    client.put(f"/api/v1/activity/{day}", json={"steps": 3000})
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
    client.put(
        "/api/v1/workouts/schedule",
        json={"days": [{"weekday": "MONDAY", "template_id": template["id"]}]},
    )
    client.post(
        "/api/v1/workouts/sessions",
        json={
            "template_id": template["id"],
            "started_at": (end - timedelta(minutes=30)).isoformat(),
            "completed_at": end.isoformat(),
            "sets": [{"exercise_id": template["exercises"][0]["id"], "set_number": 1, "repetitions": 10}],
        },
    )
    client.post(
        "/api/v1/recipes",
        json={
            "name": "Oats",
            "servings": 1,
            "serving_size": "1 bowl",
            "calories": 400,
            "ingredients": ["oats"],
            "instructions": "Cook.",
        },
    )
    db.add(AiMemory(user_id=user_id, category=MemoryCategory.OTHER, memory_text="x", status=MemoryStatus.PENDING))
    db.add(FairyNudge(user_id=user_id, nudge_date=datetime.now(UTC).date(), kind=NudgeKind.LOW_INTAKE))
    db.add(AiUsage(user_id=user_id, usage_date=datetime.now(UTC).date(), calls=3))
    db.flush()


def user_tables():
    return [t for t in Base.metadata.sorted_tables if "user_id" in t.c]


def rows_for(db, table, user_id):
    return db.scalar(select(func.count()).select_from(table).where(table.c.user_id == user_id))


def test_deleting_the_account_erases_everything_it_owned(client, db):
    user_id = register(client)
    fill_account(client, db, user_id)
    tables = user_tables()
    filled = {t.name for t in tables if rows_for(db, t, user_id) > 0}
    # Make sure the test really exercised the app, not an empty account.
    assert {
        "auth_session",
        "user_profile",
        "weight_log",
        "water_log",
        "sleep_log",
        "mood_log",
        "daily_activity",
        "food_log",
        "workout_template",
        "workout_schedule",
        "workout_session",
        "recipe",
        "garden",
        "calorie_target",
        "ai_memory",
        "fairy_nudge",
        "ai_usage",
    } <= filled

    assert delete(client).status_code == 204

    assert db.scalar(select(func.count()).select_from(User).where(User.id == user_id)) == 0
    leftovers = {t.name: rows_for(db, t, user_id) for t in tables if rows_for(db, t, user_id)}
    assert leftovers == {}
    # Child tables without their own user_id go too (food items, exercises, sets, garden items...).
    from app.models import FoodLogItem, WorkoutExercise, WorkoutSet

    for model in (FoodLogItem, WorkoutExercise, WorkoutSet):
        assert db.scalar(select(func.count()).select_from(model)) == 0


def test_the_session_ends_and_the_person_cannot_sign_in_again(client, db):
    register(client)
    assert delete(client).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert db.scalar(select(func.count()).select_from(AuthSession)) == 0
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": "rose@example.com", "password": PASSWORD})
    assert login.status_code == 401


def test_the_email_can_be_registered_again_as_a_fresh_account(client, db):
    old_id = register(client)
    client.post("/api/v1/weight", json={"weight_kg": 51})
    delete(client)
    new_id = register(client)
    assert new_id != old_id
    assert client.get("/api/v1/weight").json() == []


def test_a_wrong_password_deletes_nothing(client, db):
    user_id = register(client)
    fill_account(client, db, user_id)
    r = delete(client, "not-it")
    assert r.status_code == 400
    assert client.get("/api/v1/auth/me").status_code == 200
    assert rows_for(db, Base.metadata.tables["weight_log"], user_id) > 0


def test_deleting_needs_a_password_and_a_signed_in_person(client):
    assert delete(client).status_code == 401
    register(client)
    assert client.post(URL, json={}).status_code == 422
    assert client.post(URL, json={"password": ""}).status_code == 422
    assert client.post(URL, json={"password": PASSWORD, "email": "x@y.z"}).status_code == 422
    assert client.get("/api/v1/auth/me").status_code == 200


def test_other_peoples_accounts_are_untouched(client, db):
    keep_id = register(client, "keep@example.com")
    fill_account(client, db, keep_id)
    keep_counts = {t.name: rows_for(db, t, keep_id) for t in user_tables()}
    register(client, "leave@example.com")
    client.post("/api/v1/weight", json={"weight_kg": 60})
    assert delete(client).status_code == 204
    assert {t.name: rows_for(db, t, keep_id) for t in user_tables()} == keep_counts


def test_guessing_the_password_to_delete_is_throttled(client):
    register(client)
    from app.main import app

    clock = Clock()
    app.dependency_overrides[get_now] = lambda: clock.now
    for _ in range(LOGIN_MAX_FAILURES):
        assert delete(client, "nope").status_code == 400
    assert delete(client, "nope").status_code == 429
    assert delete(client).status_code == 429  # even the right one waits
    assert client.get("/api/v1/auth/me").status_code == 200
    clock.advance(minutes=LOGIN_FAILURE_WINDOW_MINUTES, seconds=1)
    assert delete(client).status_code == 204


def test_the_response_sets_no_session_cookie(client):
    register(client)
    response = delete(client)
    assert SESSION_COOKIE_NAME in response.headers.get("set-cookie", "")
    assert "max-age=0" in response.headers["set-cookie"].lower()
