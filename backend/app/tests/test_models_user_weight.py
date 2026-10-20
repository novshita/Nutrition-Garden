from datetime import UTC, date, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.enums import ActivityLevel, GoalType, Sex, UnitSystem
from app.models import User, UserProfile, WeightLog


def make_user(email="a@example.com") -> User:
    return User(email=email, display_name="A")


def make_profile(user: User, **overrides) -> UserProfile:
    fields = {
        "user": user,
        "date_of_birth": date(2000, 1, 1),
        "sex": Sex.FEMALE,
        "height_cm": 165.0,
        "preferred_unit_system": UnitSystem.METRIC,
        "activity_level": ActivityLevel.LIGHT,
        "goal_type": GoalType.GAIN_WEIGHT,
        "goal_weight_kg": 58.0,
        "timezone": "Asia/Kolkata",
    }
    fields.update(overrides)
    return UserProfile(**fields)


def test_user_and_profile_persist(db):
    user = make_user()
    make_profile(user)
    db.add(user)
    db.flush()
    db.refresh(user)
    assert user.id is not None
    assert user.created_at is not None
    assert user.profile.sex == Sex.FEMALE
    assert user.profile.timezone == "Asia/Kolkata"


def test_email_is_unique(db):
    db.add(make_user("dup@example.com"))
    db.flush()
    db.add(make_user("dup@example.com"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_one_profile_per_user(db):
    user = make_user()
    db.add_all([user, make_profile(user)])
    db.flush()
    db.add(make_profile(user))
    with pytest.raises(IntegrityError):
        db.flush()


def test_profile_rejects_non_positive_height(db):
    user = make_user()
    db.add_all([user, make_profile(user, height_cm=0)])
    with pytest.raises(IntegrityError):
        db.flush()


@pytest.mark.parametrize("weight", [0, -5])
def test_weight_must_be_positive(db, weight):
    user = make_user()
    db.add(user)
    db.flush()
    db.add(WeightLog(user_id=user.id, recorded_at=datetime.now(UTC), weight_kg=weight))
    with pytest.raises(IntegrityError):
        db.flush()


def test_weight_log_stores_utc_timestamp(db):
    user = make_user()
    db.add(user)
    db.flush()
    recorded = datetime(2026, 10, 20, 8, 30, tzinfo=UTC)
    log = WeightLog(user_id=user.id, recorded_at=recorded, weight_kg=52.4, note="morning")
    db.add(log)
    db.flush()
    db.refresh(log)
    assert log.recorded_at == recorded
    assert float(log.weight_kg) == pytest.approx(52.4)
