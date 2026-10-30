"""Saving food logs and reading them back (engineering spec §16–17, §21–22).

The backend calculates all nutrition; the client only says what and how much was eaten.
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import CALORIE_TARGET_MET_RATIO
from app.enums import FoodSource, GrowthAction, LogSource
from app.models import FoodLog, FoodLogItem, User
from app.schemas.food_log import (
    CustomItemIn,
    FoodLogCreate,
    FoodLogItemOut,
    FoodLogOut,
    NutritionTotalsOut,
    UsdaItemIn,
)
from app.schemas.nutrition import Micronutrient
from app.services import goals
from app.services.calculations import nutrition as calc
from app.services.errors import NotFoundError
from app.services.garden import garden as garden_service
from app.services.nutrition import food_service
from app.services.nutrition.usda_client import UsdaClient
from app.services.timezone import get_timezone, local_date_of, local_day_bounds

GRAMS = "g"


class UnknownUnitError(ValueError):
    pass


def _usda_item(db: Session, client: UsdaClient, data: UsdaItemIn, position: int) -> FoodLogItem:
    detail = food_service.get_food(db, client, data.fdc_id)  # may raise Usda* errors
    food = detail.food
    unit = data.unit.strip()
    if unit.lower() == GRAMS:
        grams_per_unit = 1.0
    else:
        match = next((p for p in food.portions if p.description.lower() == unit.lower()), None)
        if match is None:
            options = [GRAMS] + [p.description for p in food.portions]
            raise UnknownUnitError(f"Unknown unit '{unit}' for this food. Use one of: {options}")
        grams_per_unit = match.gram_weight
    scaled = calc.scale_nutrition(food.nutrition_per_100g, data.quantity * grams_per_unit)
    return FoodLogItem(
        position=position,
        food_source=FoodSource.USDA,
        external_food_id=str(food.fdc_id),
        food_name=food.name,
        quantity=data.quantity,
        unit=unit,
        serving_size=grams_per_unit,
        calories=scaled.calories,
        protein_g=scaled.protein_g,
        carbohydrate_g=scaled.carbohydrate_g,
        fat_g=scaled.fat_g,
        fiber_g=scaled.fiber_g,
        micronutrients_json={k: m.model_dump() for k, m in scaled.micronutrients.items()},
    )


def _custom_item(data: CustomItemIn, position: int) -> FoodLogItem:
    return FoodLogItem(
        position=position,
        food_source=FoodSource.CUSTOM,
        food_name=data.food_name.strip(),
        quantity=data.quantity,
        unit=data.unit.strip(),
        calories=data.calories,
        protein_g=data.protein_g,
        carbohydrate_g=data.carbohydrate_g,
        fat_g=data.fat_g,
        fiber_g=data.fiber_g,
    )


def create_food_log(
    db: Session, user: User, client: UsdaClient, data: FoodLogCreate
) -> FoodLog:
    """Build every item first so a failure on any item saves nothing."""
    items = [
        _usda_item(db, client, item, i)
        if isinstance(item, UsdaItemIn)
        else _custom_item(item, i)
        for i, item in enumerate(data.items)
    ]
    log = FoodLog(
        user_id=user.id,
        consumed_at=(data.consumed_at or datetime.now(UTC)).astimezone(UTC),
        meal_type=data.meal_type,
        source=LogSource.MANUAL,
        notes=data.notes,
        items=items,
    )
    db.add(log)
    db.flush()
    _record_growth(db, user, log)
    return log


def _record_growth(db: Session, user: User, log: FoodLog) -> None:
    day = local_date_of(db, user, log.consumed_at)
    garden_service.record(db, user, GrowthAction.FOOD_LOGGED, day)
    totals = daily_totals(list_logs_for_day(db, user, day))
    _, day_end = local_day_bounds(day, get_timezone(db, user))
    target = goals.get_target_at(db, user, day_end)
    if (
        target is not None
        and totals.calories is not None
        and totals.calories >= CALORIE_TARGET_MET_RATIO * target.target_kcal
    ):
        garden_service.record(db, user, GrowthAction.CALORIE_TARGET_MET, day)


def list_logs_for_day(db: Session, user: User, day: date) -> list[FoodLog]:
    start, end = local_day_bounds(day, get_timezone(db, user))
    return list(
        db.scalars(
            select(FoodLog)
            .where(
                FoodLog.user_id == user.id,
                FoodLog.consumed_at >= start,
                FoodLog.consumed_at < end,
            )
            .order_by(FoodLog.consumed_at.asc(), FoodLog.created_at.asc())
        )
    )


def _get_owned_log(db: Session, user: User, log_id: uuid.UUID) -> FoodLog:
    log = db.scalar(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user.id))
    if log is None:
        raise NotFoundError
    return log


def delete_log(db: Session, user: User, log_id: uuid.UUID) -> None:
    db.delete(_get_owned_log(db, user, log_id))
    db.flush()


def delete_item(db: Session, user: User, log_id: uuid.UUID, item_id: uuid.UUID) -> None:
    """Remove one food from a meal; removing the last food removes the now-empty meal."""
    log = _get_owned_log(db, user, log_id)
    item = next((i for i in log.items if i.id == item_id), None)
    if item is None:
        raise NotFoundError
    if len(log.items) == 1:
        db.delete(log)
    else:
        log.items.remove(item)
    db.flush()


def daily_totals(logs: list[FoodLog]) -> calc.NutritionTotals:
    return calc.compute_totals(item for log in logs for item in log.items)


def _f(value) -> float | None:
    return None if value is None else float(value)


def totals_out(totals: calc.NutritionTotals) -> NutritionTotalsOut:
    return NutritionTotalsOut(**totals.__dict__)


def log_out(log: FoodLog) -> FoodLogOut:
    return FoodLogOut(
        id=log.id,
        consumed_at=log.consumed_at,
        meal_type=log.meal_type,
        source=log.source,
        notes=log.notes,
        items=[
            FoodLogItemOut(
                id=i.id,
                food_source=i.food_source,
                external_food_id=i.external_food_id,
                food_name=i.food_name,
                quantity=float(i.quantity),
                unit=i.unit,
                serving_size=_f(i.serving_size),
                calories=_f(i.calories),
                protein_g=_f(i.protein_g),
                carbohydrate_g=_f(i.carbohydrate_g),
                fat_g=_f(i.fat_g),
                fiber_g=_f(i.fiber_g),
                micronutrients={
                    k: Micronutrient(**v) for k, v in (i.micronutrients_json or {}).items()
                },
                confidence=i.confidence,
            )
            for i in log.items
        ],
        totals=totals_out(calc.compute_totals(log.items)),
    )
