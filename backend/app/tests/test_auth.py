from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.config import SESSION_COOKIE_NAME
from app.models import AuthSession, User
from app.services import auth as auth_service

CREDS = {"email": "Rose@Example.com", "password": "correct-horse", "display_name": "Rose"}


def register(client, **overrides):
    return client.post("/api/v1/auth/register", json={**CREDS, **overrides})


def test_register_creates_user_and_session_cookie(client, db):
    response = register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "rose@example.com"
    assert "password" not in body and "password_hash" not in body
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").json()["id"] == body["id"]


def test_password_is_hashed_and_token_not_stored_raw(client, db):
    register(client)
    user = db.scalar(select(User))
    assert user.password_hash.startswith("$argon2")
    token = client.cookies.get(SESSION_COOKIE_NAME)
    stored = db.scalar(select(AuthSession))
    assert token and stored.token_hash != token


def test_duplicate_email_conflicts_case_insensitively(client):
    assert register(client).status_code == 201
    assert register(client, email="rose@example.com").status_code == 409


def test_register_validates_input(client):
    assert register(client, password="short").status_code == 422
    assert register(client, email="not-an-email").status_code == 422
    assert register(client, display_name="").status_code == 422


def test_login_success_and_failure(client):
    register(client)
    client.cookies.clear()
    bad = client.post("/api/v1/auth/login", json={"email": CREDS["email"], "password": "nope"})
    assert bad.status_code == 401
    unknown = client.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "nope"})
    assert unknown.status_code == 401
    assert unknown.json() == bad.json()
    ok = client.post("/api/v1/auth/login", json={"email": CREDS["email"], "password": CREDS["password"]})
    assert ok.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200


def test_me_requires_authentication(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_invalid_token_rejected(client):
    client.cookies.set(SESSION_COOKIE_NAME, "forged-token")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_invalidates_session(client, db):
    register(client)
    token = client.cookies.get(SESSION_COOKIE_NAME)
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(SESSION_COOKIE_NAME, token)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_expired_session_rejected(client, db):
    register(client)
    session = db.scalar(select(AuthSession))
    session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.flush()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_each_user_sees_only_themselves(client):
    a = register(client, email="a@example.com").json()
    client.cookies.clear()
    b = register(client, email="b@example.com").json()
    assert client.get("/api/v1/auth/me").json()["id"] == b["id"] != a["id"]


def test_verify_password_handles_garbage_hash():
    assert auth_service.verify_password("not-a-hash", "whatever") is False
