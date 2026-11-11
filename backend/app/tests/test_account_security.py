from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.api.deps import get_now
from app.config import LOGIN_FAILURE_WINDOW_MINUTES, LOGIN_MAX_FAILURES, SESSION_COOKIE_NAME
from app.models import AuthSession, User
from app.services import throttle

EMAIL = "rose@example.com"
PASSWORD = "correct-horse"
NEW_PASSWORD = "a-brand-new-password"
CREDS = {"email": EMAIL, "password": PASSWORD, "display_name": "Rose"}


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 3, 10, 12, 0, tzinfo=UTC)

    def advance(self, **delta) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock(client):
    from app.main import app

    fake = Clock()
    app.dependency_overrides[get_now] = lambda: fake.now
    return fake


def register(client, **overrides):
    return client.post("/api/v1/auth/register", json={**CREDS, **overrides})


def login(client, password=PASSWORD, email=EMAIL):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def fail_logins(client, times, email=EMAIL):
    for _ in range(times):
        assert login(client, "wrong-password", email).status_code == 401


def change(client, current=PASSWORD, new=NEW_PASSWORD):
    return client.post(
        "/api/v1/auth/password", json={"current_password": current, "new_password": new}
    )


# ---- Login rate limiting ----


def test_wrong_passwords_are_refused_after_the_limit(client, clock):
    register(client)
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES)
    blocked = login(client, "wrong-password")
    assert blocked.status_code == 429
    assert "wait about 15 minutes" in blocked.json()["detail"]
    assert blocked.headers["retry-after"] == str(LOGIN_FAILURE_WINDOW_MINUTES * 60)


def test_even_the_right_password_waits_while_locked(client, clock):
    register(client)
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES)
    assert login(client).status_code == 429
    assert client.get("/api/v1/auth/me").status_code == 401


def test_blocked_attempts_do_not_extend_the_wait(client, clock):
    register(client)
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES)
    clock.advance(minutes=5)
    for _ in range(3):
        assert login(client, "wrong-password").status_code == 429
    blocked = login(client)
    assert blocked.headers["retry-after"] == str(10 * 60)


def test_login_works_again_after_the_window(client, clock):
    register(client)
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES)
    clock.advance(minutes=LOGIN_FAILURE_WINDOW_MINUTES, seconds=1)
    assert login(client).status_code == 200


def test_just_under_the_limit_still_works_and_resets_the_count(client, clock, db):
    register(client)
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES - 1)
    assert login(client).status_code == 200
    assert throttle.failure_count(db, throttle.login_key(EMAIL)) == 0
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES - 1)  # a fresh allowance
    assert login(client).status_code == 200


def test_failures_age_out_one_by_one(client, clock):
    register(client)
    client.cookies.clear()
    fail_logins(client, 3)
    clock.advance(minutes=10)
    fail_logins(client, 2)  # five in the window now
    assert login(client).status_code == 429
    clock.advance(minutes=6)  # the first three are older than 15 minutes
    assert login(client).status_code == 200


def test_the_limit_is_per_account_and_ignores_email_case(client, clock):
    register(client)
    register(client, email="other@example.com")
    client.cookies.clear()
    fail_logins(client, LOGIN_MAX_FAILURES, email="ROSE@example.com")
    assert login(client).status_code == 429
    assert login(client, email="other@example.com").status_code == 200


def test_unknown_emails_are_throttled_the_same_way(client, clock):
    statuses = [login(client, "x", "nobody@example.com").status_code for _ in range(LOGIN_MAX_FAILURES + 2)]
    assert statuses == [401] * LOGIN_MAX_FAILURES + [429, 429]


def test_failures_are_kept_and_old_ones_tidied(client, clock, db):
    register(client)
    client.cookies.clear()
    fail_logins(client, 2)
    key = throttle.login_key(EMAIL)
    assert throttle.failure_count(db, key) == 2
    clock.advance(minutes=LOGIN_FAILURE_WINDOW_MINUTES, seconds=1)
    login(client)
    assert throttle.failure_count(db, key) == 0


# ---- Password change ----


def test_password_can_be_changed(client, db):
    register(client)
    before = db.scalar(select(User)).password_hash
    assert change(client).status_code == 204
    assert db.scalar(select(User)).password_hash != before
    client.cookies.clear()
    assert login(client, PASSWORD).status_code == 401
    assert login(client, NEW_PASSWORD).status_code == 200


def test_wrong_current_password_changes_nothing(client, db):
    register(client)
    before = db.scalar(select(User)).password_hash
    response = change(client, current="not-it")
    assert response.status_code == 400
    assert db.scalar(select(User)).password_hash == before
    assert client.get("/api/v1/auth/me").status_code == 200  # still signed in


def test_new_password_must_differ_and_be_long_enough(client):
    register(client)
    assert change(client, new=PASSWORD).status_code == 400
    assert change(client, new="short").status_code == 422
    assert change(client, new="x" * 129).status_code == 422
    assert change(client, current="").status_code == 422
    assert client.post("/api/v1/auth/password", json={"new_password": NEW_PASSWORD}).status_code == 422
    assert client.post(
        "/api/v1/auth/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD, "email": "x@y.z"},
    ).status_code == 422


def test_password_change_signs_out_other_sessions_only(client, db):
    register(client)
    old_token = client.cookies.get(SESSION_COOKIE_NAME)
    login(client)  # a second session; the cookie now points at it
    new_token = client.cookies.get(SESSION_COOKIE_NAME)
    assert old_token != new_token
    assert len(db.scalars(select(AuthSession)).all()) == 2

    assert change(client).status_code == 204
    assert len(db.scalars(select(AuthSession)).all()) == 1
    assert client.get("/api/v1/auth/me").status_code == 200

    client.cookies.set(SESSION_COOKIE_NAME, old_token)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_password_change_leaves_other_people_sessions_alone(client, db):
    register(client, email="other@example.com")
    other_token = client.cookies.get(SESSION_COOKIE_NAME)
    client.cookies.clear()
    register(client)
    assert change(client).status_code == 204
    client.cookies.set(SESSION_COOKIE_NAME, other_token)
    assert client.get("/api/v1/auth/me").json()["email"] == "other@example.com"


def test_password_change_requires_sign_in(client):
    assert change(client).status_code == 401


def test_guessing_the_current_password_is_throttled(client, clock):
    register(client)
    for _ in range(LOGIN_MAX_FAILURES):
        assert change(client, current="nope").status_code == 400
    assert change(client, current="nope").status_code == 429
    assert change(client).status_code == 429  # even the right one waits
    clock.advance(minutes=LOGIN_FAILURE_WINDOW_MINUTES, seconds=1)
    assert change(client).status_code == 204


def test_password_change_throttle_is_separate_from_login(client, clock):
    register(client)
    for _ in range(LOGIN_MAX_FAILURES):
        change(client, current="nope")
    client.cookies.clear()
    assert login(client).status_code == 200


def test_a_successful_change_resets_its_failures(client, clock, db):
    register(client)
    for _ in range(LOGIN_MAX_FAILURES - 1):
        change(client, current="nope")
    assert change(client).status_code == 204
    user = db.scalar(select(User))
    assert throttle.failure_count(db, throttle.password_key(user.id)) == 0


# ---- Display name ----


def test_display_name_can_be_changed_and_is_trimmed(client):
    register(client)
    response = client.patch("/api/v1/auth/me", json={"display_name": "  Rosie  "})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Rosie"
    assert client.get("/api/v1/auth/me").json()["display_name"] == "Rosie"


def test_display_name_is_validated(client):
    register(client)
    for bad in ("", "   ", "x" * 101):
        assert client.patch("/api/v1/auth/me", json={"display_name": bad}).status_code == 422
    assert client.patch("/api/v1/auth/me", json={}).status_code == 422
    assert client.get("/api/v1/auth/me").json()["display_name"] == "Rose"


def test_only_the_name_can_be_changed_here(client):
    register(client)
    body = {"display_name": "Rosie", "email": "new@example.com"}
    assert client.patch("/api/v1/auth/me", json=body).status_code == 422
    assert client.get("/api/v1/auth/me").json()["email"] == EMAIL


def test_display_name_change_requires_sign_in_and_touches_only_me(client, db):
    assert client.patch("/api/v1/auth/me", json={"display_name": "X"}).status_code == 401
    register(client, email="other@example.com", display_name="Other")
    client.cookies.clear()
    register(client)
    client.patch("/api/v1/auth/me", json={"display_name": "Rosie"})
    names = {u.email: u.display_name for u in db.scalars(select(User))}
    assert names == {"other@example.com": "Other", EMAIL: "Rosie"}


def test_registering_with_a_blank_name_is_refused(client):
    assert register(client, display_name="   ").status_code == 422


def test_no_response_exposes_password_material(client):
    body = register(client).json()
    assert set(body) == {"id", "email", "display_name"}
    assert set(client.patch("/api/v1/auth/me", json={"display_name": "R"}).json()) == set(body)


def test_the_cookie_is_secure_in_production_unless_told_otherwise(client, monkeypatch):
    import app.api.v1.auth as auth_api

    def settings(env, flag):
        return type("S", (), {"app_env": env, "cookie_secure": flag})()

    for env, flag, expected in [
        ("production", None, True),
        ("development", None, False),
        ("production", False, False),
        ("development", True, True),
    ]:
        monkeypatch.setattr(auth_api, "get_settings", lambda e=env, f=flag: settings(e, f))
        assert auth_api._cookie_secure() is expected
