"""Achievements are the garden milestones, shown as a full list of earned and upcoming ones.

Nothing here can lose progress: an achievement once earned stays earned (product spec §32, §35).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import (
    CONSISTENT_DAY_MILESTONES,
    FIRST_WEEK_ACTIVE_DAYS,
    GROWTH_STAGE_THRESHOLDS,
    HYDRATION_DAY_MILESTONES,
    WEIGHT_PROGRESS_MILESTONES_PERCENT,
    WORKOUT_DAY_MILESTONES,
)
from app.enums import MilestoneType
from app.models import GardenMilestone, User
from app.schemas.garden import AchievementOut
from app.services.garden import garden as garden_service


def catalog() -> list[tuple[MilestoneType, int]]:
    """Every achievement that exists, in the order they're shown. Built from the same config as the
    rules that award them, so the two can't drift apart."""
    entries: list[tuple[MilestoneType, int]] = [
        (MilestoneType.FIRST_LOG, 1),
        (MilestoneType.FIRST_WORKOUT, 1),
        (MilestoneType.FIRST_WEEK, FIRST_WEEK_ACTIVE_DAYS),
    ]
    entries += [(MilestoneType.CONSISTENT_TRACKING, n) for n in CONSISTENT_DAY_MILESTONES]
    entries += [(MilestoneType.WORKOUT_STREAK, n) for n in WORKOUT_DAY_MILESTONES]
    entries += [(MilestoneType.HYDRATION_MILESTONE, n) for n in HYDRATION_DAY_MILESTONES]
    entries += [(MilestoneType.WEIGHT_MILESTONE, p) for p in WEIGHT_PROGRESS_MILESTONES_PERCENT]
    entries += [(MilestoneType.GARDEN_STAGE, stage) for stage in range(2, len(GROWTH_STAGE_THRESHOLDS) + 1)]
    return entries


def list_achievements(db: Session, user: User) -> list[AchievementOut]:
    garden = garden_service.ensure_garden(db, user)
    garden_service.reconcile_milestones(db, user, garden)  # catch up on anything already earned
    earned = {
        (m.milestone_type, m.trigger_value): m.unlocked_at
        for m in db.scalars(select(GardenMilestone).where(GardenMilestone.garden_id == garden.id))
    }
    listed = catalog()
    out = [
        AchievementOut(
            milestone_type=kind,
            trigger_value=value,
            unlocked=(kind, value) in earned,
            unlocked_at=earned.get((kind, value)),
        )
        for kind, value in listed
    ]
    # Anything earned under an older rule set stays visible.
    known = set(listed)
    for (kind, value), when in sorted(earned.items(), key=lambda item: item[1]):
        if (kind, value) not in known:
            out.append(AchievementOut(milestone_type=kind, trigger_value=value, unlocked=True, unlocked_at=when))
    return out
