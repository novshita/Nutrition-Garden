from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.config import (
    CONSISTENT_DAY_MILESTONES,
    GROWTH_STAGE_THRESHOLDS,
    HYDRATION_DAY_MILESTONES,
    WEIGHT_PROGRESS_MILESTONES_PERCENT,
    WORKOUT_DAY_MILESTONES,
)
from app.enums import MilestoneType
from app.models import GardenMilestone
from app.services.garden.achievements import catalog
from app.tests.ai_helpers import login, onboard, signup

URL = "/api/v1/garden/achievements"


def achievements(client):
    r = client.get(URL)
    assert r.status_code == 200, r.text
    return {(a["milestone_type"], a["trigger_value"]): a for a in r.json()}


def unlocked(client):
    return {key for key, a in achievements(client).items() if a["unlocked"]}


def water(client, days_ago=0):
    at = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    assert client.post("/api/v1/water", json={"amount_ml": 250, "consumed_at": at}).status_code == 201


def workout(client, days_ago=0):
    template = client.get("/api/v1/workouts/templates").json()
    if not template:
        template = [
            client.post(
                "/api/v1/workouts/templates",
                json={
                    "name": "T",
                    "exercises": [{"exercise_name": "Plank", "exercise_type": "TIME", "category": "CORE", "default_duration_seconds": 30}],
                },
            ).json()
        ]
    end = datetime.now(UTC) - timedelta(days=days_ago, minutes=5)
    r = client.post(
        "/api/v1/workouts/sessions",
        json={"template_id": template[0]["id"], "started_at": (end - timedelta(minutes=20)).isoformat(), "completed_at": end.isoformat()},
    )
    assert r.status_code == 201


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_the_full_list_is_shown_with_everything_still_ahead_at_the_start(client):
    signup(client)
    listed = achievements(client)
    assert set(listed) == set(catalog())
    assert not any(a["unlocked"] for a in listed.values())
    assert all(a["unlocked_at"] is None for a in listed.values())


def test_catalog_covers_every_milestone_type_from_the_same_config_as_the_rules():
    entries = catalog()
    assert {kind for kind, _ in entries} == set(MilestoneType)
    assert len(entries) == len(set(entries))  # no duplicates
    by_type = {}
    for kind, value in entries:
        by_type.setdefault(kind, []).append(value)
    assert by_type[MilestoneType.CONSISTENT_TRACKING] == list(CONSISTENT_DAY_MILESTONES)
    assert by_type[MilestoneType.WORKOUT_STREAK] == list(WORKOUT_DAY_MILESTONES)
    assert by_type[MilestoneType.HYDRATION_MILESTONE] == list(HYDRATION_DAY_MILESTONES)
    assert by_type[MilestoneType.WEIGHT_MILESTONE] == list(WEIGHT_PROGRESS_MILESTONES_PERCENT)
    assert by_type[MilestoneType.GARDEN_STAGE] == list(range(2, len(GROWTH_STAGE_THRESHOLDS) + 1))


def test_first_workout_is_earned_by_the_first_workout(client):
    signup(client)
    assert ("FIRST_WORKOUT", 1) not in unlocked(client)
    workout(client)
    assert ("FIRST_WORKOUT", 1) in unlocked(client)
    entry = achievements(client)[("FIRST_WORKOUT", 1)]
    assert entry["unlocked_at"] is not None


def test_first_meal_is_earned_by_the_first_log(client):
    signup(client)
    client.post(
        "/api/v1/food/log",
        json={"meal_type": "LUNCH", "items": [{"food_source": "CUSTOM", "food_name": "Dal", "quantity": 1, "unit": "bowl", "calories": 200}]},
    )
    assert ("FIRST_LOG", 1) in unlocked(client)


def test_consistent_tracking_counts_days_with_anything_logged_not_a_streak(client):
    signup(client)
    # 14 days with gaps between them: nothing needs to be consecutive.
    for day in range(0, 28, 2):
        water(client, day)
    got = unlocked(client)
    assert ("CONSISTENT_TRACKING", 14) in got
    assert ("FIRST_WEEK", 7) in got
    assert ("CONSISTENT_TRACKING", 30) not in got


def test_consistent_tracking_needs_the_full_number_of_days(client):
    signup(client)
    for day in range(13):
        water(client, day)
    assert ("CONSISTENT_TRACKING", 14) not in unlocked(client)
    water(client, 13)
    assert ("CONSISTENT_TRACKING", 14) in unlocked(client)


def test_garden_stages_weight_and_hydration_show_up_here_too(client):
    signup(client)
    onboard(client)
    for day in range(50):
        water(client, day)
    got = unlocked(client)
    assert ("GARDEN_STAGE", 2) in got
    assert ("HYDRATION_MILESTONE", 7) in got and ("HYDRATION_MILESTONE", 30) in got
    assert ("CONSISTENT_TRACKING", 30) in got
    assert ("GARDEN_STAGE", 3) not in got


def test_earned_achievements_are_permanent(client, db):
    """Nothing is ever taken away, however the data changes afterwards (product spec §32)."""
    signup(client)
    for day in range(8):
        water(client, day)
    before = unlocked(client)
    assert ("FIRST_WEEK", 7) in before
    # Remove every water entry; the achievements stay earned.
    for entry in client.get("/api/v1/water").json()["entries"]:
        client.delete(f"/api/v1/water/{entry['id']}")
    assert before <= unlocked(client)


def test_progress_made_before_a_type_existed_is_caught_up(client, db):
    """Someone who earned FIRST_WORKOUT-worthy progress earlier gets it the first time they look."""
    signup(client)
    workout(client)
    assert ("FIRST_WORKOUT", 1) in unlocked(client)
    db.execute(delete(GardenMilestone).where(GardenMilestone.milestone_type == MilestoneType.FIRST_WORKOUT))
    db.flush()
    assert ("FIRST_WORKOUT", 1) not in {
        (m.milestone_type.value, m.trigger_value) for m in db.scalars(select(GardenMilestone))
    }
    assert ("FIRST_WORKOUT", 1) in unlocked(client)  # looking at the list restores it


def test_listing_twice_never_duplicates_anything(client, db):
    signup(client)
    for day in range(10):
        water(client, day)
    first = client.get(URL).json()
    second = client.get(URL).json()
    assert first == second
    keys = [(a["milestone_type"], a["trigger_value"]) for a in second]
    assert len(keys) == len(set(keys))
    rows = db.scalars(select(GardenMilestone)).all()
    assert len({(m.milestone_type, m.trigger_value) for m in rows}) == len(rows)


def test_the_garden_milestones_endpoint_agrees_with_achievements(client):
    signup(client)
    for day in range(8):
        water(client, day)
    earned = {
        (m["milestone_type"], m["trigger_value"]) for m in client.get("/api/v1/garden/milestones").json()
    }
    assert earned <= unlocked(client)
    assert ("FIRST_WEEK", 7) in earned


def test_achievements_are_private(client):
    signup(client, "a@example.com")
    for day in range(8):
        water(client, day)
    assert ("FIRST_WEEK", 7) in unlocked(client)
    signup(client, "b@example.com")
    assert unlocked(client) == set()
    login(client, "a@example.com")
    assert ("FIRST_WEEK", 7) in unlocked(client)
