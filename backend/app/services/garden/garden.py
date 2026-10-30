"""Garden growth, milestones and items (engineering spec §35-42, §61).

Growth is deterministic and only ever goes up. Each action earns its points at most once per local
day, tracked in a ledger, so repeating, editing or deleting entries can't change progress.
"""

import logging
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import (
    DEFAULT_GARDEN_NAME,
    FIRST_WEEK_ACTIVE_DAYS,
    GARDEN_ITEM_CATALOG,
    GROWTH_POINTS_PER_ACTION,
    HYDRATION_DAY_MILESTONES,
    WORKOUT_DAY_MILESTONES,
)
from app.enums import GrowthAction, MilestoneType
from app.models import (
    Garden,
    GardenGrowthEvent,
    GardenItem,
    GardenMilestone,
    GardenProgress,
    User,
    UserProfile,
    WeightLog,
)
from app.schemas.garden import GardenItemOut, GardenOut, ItemPosition, MilestoneOut
from app.services.calculations import garden as rules
from app.services.errors import NotFoundError
from app.services.timezone import local_today

logger = logging.getLogger(__name__)


# Setup ---------------------------------------------------------------------------------


def ensure_garden(db: Session, user: User) -> Garden:
    garden = db.scalar(select(Garden).where(Garden.user_id == user.id))
    if garden is not None:
        return garden
    try:
        with db.begin_nested():  # a concurrent request may create it first
            garden = Garden(user_id=user.id, name=DEFAULT_GARDEN_NAME)
            garden.progress = GardenProgress(growth_points=0, growth_stage=1)
            db.add(garden)
    except IntegrityError:
        return db.scalar(select(Garden).where(Garden.user_id == user.id))
    _unlock_items(db, garden, 1)
    return garden


def _unlock_items(db: Session, garden: Garden, stage: int) -> None:
    have = set(db.scalars(select(GardenItem.item_key).where(GardenItem.garden_id == garden.id)))
    for unlock_stage, item_type, item_key in GARDEN_ITEM_CATALOG:
        if unlock_stage == stage and item_key not in have:
            db.add(GardenItem(garden_id=garden.id, item_type=item_type, item_key=item_key))
    db.flush()


def _add_milestone(db: Session, garden: Garden, kind: MilestoneType, value: int) -> None:
    exists = db.scalar(
        select(GardenMilestone.id).where(
            GardenMilestone.garden_id == garden.id,
            GardenMilestone.milestone_type == kind,
            GardenMilestone.trigger_value == value,
        )
    )
    if exists is None:
        db.add(GardenMilestone(garden_id=garden.id, milestone_type=kind, trigger_value=value))
        db.flush()


# Growth --------------------------------------------------------------------------------


def record(db: Session, user: User, action: GrowthAction, day: date) -> None:
    """Award growth for `action` on local date `day`, once. Safe to call repeatedly."""
    garden = ensure_garden(db, user)
    try:
        with db.begin_nested():
            db.add(
                GardenGrowthEvent(
                    garden_id=garden.id,
                    action=action,
                    event_date=day,
                    points=GROWTH_POINTS_PER_ACTION,
                )
            )
    except IntegrityError:
        # Already earned today, so no points. A new weight can still reach a goal milestone.
        if action == GrowthAction.WEIGHT_LOGGED:
            _check_weight_milestones(db, user, garden)
        return

    progress = garden.progress
    old_stage = progress.growth_stage
    progress.growth_points += GROWTH_POINTS_PER_ACTION
    progress.growth_stage = max(old_stage, rules.stage_for_points(progress.growth_points))
    db.flush()

    for stage in range(old_stage + 1, progress.growth_stage + 1):
        _unlock_items(db, garden, stage)
        _add_milestone(db, garden, MilestoneType.GARDEN_STAGE, stage)
    _check_milestones(db, user, garden, action)


def _count_days(db: Session, garden: Garden, action: GrowthAction | None = None) -> int:
    query = select(func.count(func.distinct(GardenGrowthEvent.event_date))).where(
        GardenGrowthEvent.garden_id == garden.id
    )
    if action is not None:
        query = query.where(GardenGrowthEvent.action == action)
    return db.scalar(query) or 0


def _check_milestones(db: Session, user: User, garden: Garden, action: GrowthAction) -> None:
    if action == GrowthAction.FOOD_LOGGED:
        _add_milestone(db, garden, MilestoneType.FIRST_LOG, 1)
    if _count_days(db, garden) >= FIRST_WEEK_ACTIVE_DAYS:
        _add_milestone(db, garden, MilestoneType.FIRST_WEEK, FIRST_WEEK_ACTIVE_DAYS)
    if action == GrowthAction.WORKOUT_COMPLETED:
        days = _count_days(db, garden, action)
        for threshold in WORKOUT_DAY_MILESTONES:
            if days >= threshold:
                _add_milestone(db, garden, MilestoneType.WORKOUT_STREAK, threshold)
    if action == GrowthAction.WATER_LOGGED:
        days = _count_days(db, garden, action)
        for threshold in HYDRATION_DAY_MILESTONES:
            if days >= threshold:
                _add_milestone(db, garden, MilestoneType.HYDRATION_MILESTONE, threshold)
    if action == GrowthAction.WEIGHT_LOGGED:
        _check_weight_milestones(db, user, garden)


def _check_weight_milestones(db: Session, user: User, garden: Garden) -> None:
    goal = db.scalar(select(UserProfile.goal_weight_kg).where(UserProfile.user_id == user.id))
    first = db.scalar(
        select(WeightLog.weight_kg)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.asc())
        .limit(1)
    )
    latest = db.scalar(
        select(WeightLog.weight_kg)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.desc())
        .limit(1)
    )
    if goal is None or first is None or latest is None:
        return
    percent = rules.weight_progress_percent(float(first), float(latest), float(goal))
    for value in rules.weight_milestones_reached(percent):
        _add_milestone(db, garden, MilestoneType.WEIGHT_MILESTONE, value)  # never taken back


# Reading -------------------------------------------------------------------------------


def get_garden(db: Session, user: User) -> GardenOut:
    garden = ensure_garden(db, user)
    points = garden.progress.growth_points
    next_at = rules.next_stage_threshold(points)
    today = local_today(db, user)
    actions = db.scalars(
        select(GardenGrowthEvent.action)
        .where(GardenGrowthEvent.garden_id == garden.id, GardenGrowthEvent.event_date == today)
        .order_by(GardenGrowthEvent.created_at.asc())
    )
    return GardenOut(
        id=garden.id,
        name=garden.name,
        growth_points=points,
        growth_stage=garden.progress.growth_stage,
        bunny_stage=garden.progress.growth_stage,
        next_stage_at_points=next_at,
        points_to_next_stage=None if next_at is None else next_at - points,
        today_actions=list(actions),
    )


def _item_out(item: GardenItem) -> GardenItemOut:
    return GardenItemOut(
        id=item.id,
        item_type=item.item_type,
        item_key=item.item_key,
        placed=item.position is not None,
        position=ItemPosition(**item.position) if item.position else None,
        rotation=item.rotation,
        unlocked_at=item.unlocked_at,
    )


def list_items(db: Session, user: User) -> list[GardenItemOut]:
    garden = ensure_garden(db, user)
    items = db.scalars(
        select(GardenItem)
        .where(GardenItem.garden_id == garden.id)
        .order_by(GardenItem.unlocked_at.asc(), GardenItem.item_key.asc())
    )
    return [_item_out(i) for i in items]


def place_item(
    db: Session, user: User, item_id: uuid.UUID, x: float, y: float, rotation: float
) -> GardenItemOut:
    garden = ensure_garden(db, user)
    item = db.scalar(
        select(GardenItem).where(GardenItem.id == item_id, GardenItem.garden_id == garden.id)
    )
    if item is None:
        raise NotFoundError
    item.position = {"x": x, "y": y}
    item.rotation = rotation
    db.flush()
    return _item_out(item)


def list_milestones(db: Session, user: User) -> list[MilestoneOut]:
    garden = ensure_garden(db, user)
    rows = db.scalars(
        select(GardenMilestone)
        .where(GardenMilestone.garden_id == garden.id)
        .order_by(GardenMilestone.unlocked_at.asc(), GardenMilestone.trigger_value.asc())
    )
    return [
        MilestoneOut(
            milestone_type=m.milestone_type,
            trigger_value=m.trigger_value,
            unlocked_at=m.unlocked_at,
        )
        for m in rows
    ]



def get_day_growth(db: Session, user: User, day: date) -> tuple[int, list[GrowthAction]]:
    """Points and actions that earned growth on a local day."""
    garden = ensure_garden(db, user)
    rows = db.execute(
        select(GardenGrowthEvent.action, GardenGrowthEvent.points)
        .where(GardenGrowthEvent.garden_id == garden.id, GardenGrowthEvent.event_date == day)
        .order_by(GardenGrowthEvent.created_at.asc())
    ).all()
    return sum(r.points for r in rows), [r.action for r in rows]
