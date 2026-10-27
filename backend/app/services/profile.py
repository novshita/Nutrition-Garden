"""Onboarding and profile summary. All calculations are done here, never by AI."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import CalorieTargetSource, GoalType
from app.models import User, UserProfile, WeightLog
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileSummary
from app.services import goals
from app.services.calculations import body


class ProfileExistsError(Exception):
    pass


def create_profile(db: Session, user: User, data: ProfileCreate) -> ProfileSummary:
    if db.scalar(select(UserProfile.id).where(UserProfile.user_id == user.id)) is not None:
        raise ProfileExistsError

    profile = UserProfile(
        user_id=user.id,
        date_of_birth=data.date_of_birth,
        sex=data.sex,
        height_cm=data.height_cm,
        preferred_unit_system=data.preferred_unit_system,
        activity_level=data.activity_level,
        goal_type=GoalType.GAIN_WEIGHT,
        goal_weight_kg=data.goal_weight_kg,
        timezone=data.timezone,
    )
    db.add(profile)
    db.add(WeightLog(user_id=user.id, recorded_at=datetime.now(UTC), weight_kg=data.weight_kg))
    db.flush()

    summary = _build_summary(profile, data.weight_kg)
    goals.set_target(
        db,
        user,
        summary.calorie_target_kcal,
        CalorieTargetSource.INITIAL_ESTIMATE,
        "Initial estimate: TDEE + 250 kcal/day",
    )
    return summary


def get_summary(db: Session, user: User) -> ProfileSummary | None:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        return None
    latest = db.scalar(
        select(WeightLog)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.desc())
        .limit(1)
    )
    if latest is None:
        return None
    summary = _build_summary(profile, float(latest.weight_kg))
    current = goals.get_current_target(db, user)
    if current is not None:
        summary.calorie_target_kcal = current.target_kcal
    return summary


def _build_summary(profile: UserProfile, weight_kg: float) -> ProfileSummary:
    height_cm = float(profile.height_cm)
    today = datetime.now(ZoneInfo(profile.timezone)).date()
    age = body.age_in_years(profile.date_of_birth, today)
    bmr_kcal = body.bmr(weight_kg, height_cm, age, profile.sex)
    tdee_kcal = body.tdee(bmr_kcal, profile.activity_level)
    return ProfileSummary(
        profile=ProfileResponse.model_validate(profile),
        current_weight_kg=weight_kg,
        bmi=round(body.bmi(weight_kg, height_cm), 1),
        bmr_kcal=round(bmr_kcal, 1),
        tdee_kcal=round(tdee_kcal, 1),
        calorie_target_kcal=body.initial_calorie_target(tdee_kcal),
    )
