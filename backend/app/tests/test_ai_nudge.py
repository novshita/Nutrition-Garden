from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app import config
from app.api.deps import get_now
from app.main import app
from app.models import CalorieTarget
from app.tests.ai_helpers import eat, onboard, signup

NUDGE = "/api/v1/ai/nudge"


def at(hour: int, minute: int = 0, days: int = 0) -> datetime:
    base = datetime.now(UTC).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base + timedelta(days=days)


def set_now(moment: datetime):
    app.dependency_overrides[get_now] = lambda: moment


def ready(client, db, tz="UTC"):
    """A signed-up person with a calorie goal that has been in place for a while."""
    signup(client)
    onboard(client, tz=tz)
    db.execute(update(CalorieTarget).values(effective_from=datetime.now(UTC) - timedelta(days=10)))
    db.flush()


def nudge(client):
    r = client.get(NUDGE)
    assert r.status_code == 200, r.text
    return r.json()


def test_requires_authentication(client):
    assert client.get(NUDGE).status_code == 401


def test_nothing_before_the_evening(client, db):
    ready(client, db)
    set_now(at(17, 59))
    assert nudge(client) == {"show": False, "message": None}


def test_a_gentle_reminder_in_the_evening_when_today_has_been_light(client, db):
    ready(client, db)
    eat(client, 300)
    set_now(at(18, 0))
    result = nudge(client)
    assert result["show"] is True
    assert result["message"] == (
        "You still have some room left in today's nutrition garden. Want a few easy meal ideas?"
    )
    assert not any(w in result["message"].lower() for w in ("should", "must", "failed", "behind", "only"))


def test_at_most_one_reminder_a_day(client, db):
    """The cooldown: no repeated reminders (engineering spec §48)."""
    ready(client, db)
    set_now(at(18, 30))
    assert nudge(client)["show"] is True
    for hour in (18, 19, 21, 23):
        set_now(at(hour, 45))
        assert nudge(client)["show"] is False


def test_a_new_day_brings_a_new_chance(client, db):
    ready(client, db)
    set_now(at(19))
    assert nudge(client)["show"] is True
    set_now(at(19, days=1))
    assert nudge(client)["show"] is True
    assert nudge(client)["show"] is False


def test_no_reminder_when_the_day_has_gone_well(client, db):
    ready(client, db)
    target = client.get("/api/v1/goals/calorie-target").json()["current"]["target_kcal"]
    eat(client, round(target * config.NUDGE_BELOW_RATIO) + 10)
    set_now(at(20))
    assert nudge(client)["show"] is False


def test_the_threshold_is_the_configured_share_of_the_goal(client, db, monkeypatch):
    monkeypatch.setattr(config, "NUDGE_BELOW_RATIO", 0.5)
    ready(client, db)
    client.put("/api/v1/goals/calorie-target", json={"target_kcal": 2000})
    db.execute(update(CalorieTarget).values(effective_from=datetime.now(UTC) - timedelta(days=10)))
    db.flush()
    eat(client, 1000)  # exactly half: not "significantly below"
    set_now(at(20))
    assert nudge(client)["show"] is False


def test_no_reminder_without_a_goal_to_compare_with(client, db):
    signup(client)  # not onboarded, so no calorie goal
    set_now(at(20))
    assert nudge(client)["show"] is False


def test_the_evening_follows_the_persons_own_time_zone(client, db):
    ready(client, db, tz="Asia/Kolkata")  # UTC+5:30
    set_now(at(12, 0))  # 17:30 there
    assert nudge(client)["show"] is False
    set_now(at(12, 30))  # 18:00 there
    assert nudge(client)["show"] is True


def test_a_missed_reminder_never_affects_garden_progress(client, db):
    ready(client, db)
    before = client.get("/api/v1/garden").json()["growth_points"]
    set_now(at(20))
    nudge(client)
    assert client.get("/api/v1/garden").json()["growth_points"] == before


def test_reminders_are_per_person(client, db):
    ready(client, db)
    set_now(at(19))
    assert nudge(client)["show"] is True
    signup(client, "b@example.com")
    onboard(client)
    db.execute(update(CalorieTarget).values(effective_from=datetime.now(UTC) - timedelta(days=10)))
    db.flush()
    assert nudge(client)["show"] is True  # b is not affected by a's cooldown


def test_the_reminder_works_with_no_ai_at_all(client, db):
    """It is decided by the backend and uses fixed wording, so it never needs the AI."""
    ready(client, db)
    from app.services.ai.client import get_ai_client

    def explode():
        raise AssertionError("the nudge must not need the AI client")

    app.dependency_overrides[get_ai_client] = explode
    set_now(at(19))
    assert nudge(client)["show"] is True
