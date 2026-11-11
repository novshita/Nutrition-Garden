import re

import pytest
from sqlalchemy import func, select

from app.config import PASSWORD_RESET_LIFETIME_MINUTES, PASSWORD_RESET_MAX_PER_HOUR
from app.models import PasswordReset
from app.services import mailer
from app.tests.test_account_security import (
    EMAIL,
    NEW_PASSWORD,
    PASSWORD,
    Clock,
    login,
    register,
)

FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"


@pytest.fixture
def clock(client):
    from app.api.deps import get_now
    from app.main import app

    fake = Clock()
    app.dependency_overrides[get_now] = lambda: fake.now
    return fake


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "send_email", lambda to, subject, body: sent.append((to, subject, body)))
    return sent


def token_from(outbox, index=-1):
    return re.search(r"reset-password\?token=([\w-]+)", outbox[index][2]).group(1)


def ask(client, email=EMAIL):
    return client.post(FORGOT, json={"email": email})


def reset(client, token, password=NEW_PASSWORD):
    return client.post(RESET, json={"token": token, "new_password": password})


def test_a_reset_link_is_emailed_and_sets_a_new_password(client, clock, outbox):
    register(client)
    client.cookies.clear()
    assert ask(client).status_code == 202
    to, subject, body = outbox[0]
    assert to == EMAIL and "password" in subject.lower()
    assert "http://localhost:3000/reset-password?token=" in body
    assert reset(client, token_from(outbox)).status_code == 204
    assert login(client, NEW_PASSWORD).status_code == 200
    client.cookies.clear()
    assert login(client, PASSWORD).status_code == 401


def test_the_answer_is_the_same_for_unknown_emails_and_nothing_is_sent(client, clock, outbox):
    register(client)
    known, unknown = ask(client), ask(client, "nobody@example.com")
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox) == 1


def test_a_link_works_only_once(client, clock, outbox):
    register(client)
    ask(client)
    token = token_from(outbox)
    assert reset(client, token).status_code == 204
    again = reset(client, token, "another-password-1")
    assert again.status_code == 400 and "isn't valid" in again.json()["detail"]


def test_a_link_expires(client, clock, outbox):
    register(client)
    ask(client)
    clock.advance(minutes=PASSWORD_RESET_LIFETIME_MINUTES, seconds=1)
    assert reset(client, token_from(outbox)).status_code == 400
    assert login(client, PASSWORD).status_code == 200  # the old password still works


def test_a_made_up_token_is_refused(client, clock, outbox):
    register(client)
    assert reset(client, "x" * 43).status_code == 400


def test_the_new_password_must_be_long_enough(client, clock, outbox):
    register(client)
    ask(client)
    assert reset(client, token_from(outbox), "short").status_code == 422
    assert reset(client, token_from(outbox), NEW_PASSWORD).status_code == 204  # the link wasn't used up


def test_resetting_signs_the_account_out_everywhere(client, clock, outbox):
    register(client)
    assert client.get("/api/v1/auth/me").status_code == 200
    ask(client)
    reset(client, token_from(outbox))
    assert client.get("/api/v1/auth/me").status_code == 401


def test_using_one_link_cancels_the_others(client, clock, outbox, db):
    register(client)
    ask(client)
    ask(client)
    assert reset(client, token_from(outbox, 0)).status_code == 204
    assert reset(client, token_from(outbox, 1), "yet-another-password").status_code == 400
    assert db.scalar(select(func.count()).select_from(PasswordReset)) == 0


def test_only_a_few_links_can_be_requested_per_hour(client, clock, outbox):
    register(client)
    for _ in range(PASSWORD_RESET_MAX_PER_HOUR + 2):
        assert ask(client).status_code == 202
    assert len(outbox) == PASSWORD_RESET_MAX_PER_HOUR
    clock.advance(hours=1, minutes=1)
    ask(client)
    assert len(outbox) == PASSWORD_RESET_MAX_PER_HOUR + 1


def test_the_token_is_stored_only_as_a_hash(client, clock, outbox, db):
    register(client)
    ask(client)
    token = token_from(outbox)
    assert db.scalar(select(PasswordReset.token_hash)) != token


def test_bad_emails_are_rejected(client, clock, outbox):
    assert client.post(FORGOT, json={"email": "not-an-email"}).status_code == 422
    assert outbox == []


def test_without_smtp_the_link_is_only_logged_outside_production(monkeypatch, caplog):
    def settings(env):
        return type("S", (), {"smtp_host": None, "app_env": env})()

    monkeypatch.setattr(mailer, "get_settings", lambda: settings("development"))
    mailer.send_email("a@example.com", "Hi", "SECRET-LINK")
    assert "SECRET-LINK" in caplog.text
    caplog.clear()
    monkeypatch.setattr(mailer, "get_settings", lambda: settings("production"))
    mailer.send_email("a@example.com", "Hi", "SECRET-LINK")
    assert "SECRET-LINK" not in caplog.text


def test_smtp_failures_never_raise(monkeypatch):
    import smtplib

    settings = type("S", (), {"smtp_host": "smtp.invalid", "smtp_port": 587, "smtp_user": None,
                               "smtp_password": None, "smtp_from": None, "app_env": "production"})()
    monkeypatch.setattr(mailer, "get_settings", lambda: settings)

    class Boom:
        def __init__(self, *a, **k):
            raise smtplib.SMTPConnectError(421, "no")

    monkeypatch.setattr(mailer.smtplib, "SMTP", Boom)
    mailer.send_email("a@example.com", "Hi", "body")  # no exception
