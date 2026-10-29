import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.food_log import FoodLogCreate, FoodLogDay, FoodLogOut
from app.services.errors import NotFoundError
from app.services.nutrition import food_logging
from app.services.nutrition.usda_client import (
    UsdaClient,
    UsdaNotFoundError,
    UsdaUnavailableError,
    get_usda_client,
)
from app.services.timezone import local_today

# Registered before the food router so "/food/log" is not read as "/food/{fdc_id}".
router = APIRouter(prefix="/food/log", tags=["food-log"])

Usda = Annotated[UsdaClient, Depends(get_usda_client)]


@router.post("", response_model=FoodLogOut, status_code=status.HTTP_201_CREATED)
def create_food_log(body: FoodLogCreate, user: CurrentUser, db: DbSession, usda: Usda) -> FoodLogOut:
    try:
        log = food_logging.create_food_log(db, user, usda, body)
    except UsdaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "A food in this log was not found") from None
    except UsdaUnavailableError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The food database is temporarily unavailable. You can retry or enter the food manually.",
        ) from None
    except food_logging.UnknownUnitError as exc:
        raise HTTPException(422, str(exc)) from None
    out = food_logging.log_out(log)
    db.commit()
    return out


@router.get("", response_model=FoodLogDay)
def list_food_logs(user: CurrentUser, db: DbSession, day: date | None = None) -> FoodLogDay:
    """Food logs for one local day (default today). Query parameter: `day`."""
    day = day or local_today(db, user)
    logs = food_logging.list_logs_for_day(db, user, day)
    return FoodLogDay(date=day, logs=[food_logging.log_out(log) for log in logs])


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_log(log_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    try:
        food_logging.delete_log(db, user, log_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Food log not found") from None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{log_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_log_item(
    log_id: uuid.UUID, item_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> Response:
    """Remove one food from a meal. Removing the last food removes the empty meal."""
    try:
        food_logging.delete_item(db, user, log_id, item_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Food log item not found") from None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
