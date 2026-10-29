import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.daily import WaterCreate, WaterDay, WaterEntry
from app.services import daily
from app.services.errors import NotFoundError
from app.services.timezone import local_today

router = APIRouter(prefix="/water", tags=["water"])


@router.post("", response_model=WaterEntry, status_code=status.HTTP_201_CREATED)
def log_water(body: WaterCreate, user: CurrentUser, db: DbSession) -> WaterEntry:
    log = daily.add_water(db, user, body.amount_ml, body.consumed_at)
    db.commit()
    return log


@router.get("", response_model=WaterDay)
def get_water(user: CurrentUser, db: DbSession, day: date | None = None) -> WaterDay:
    """Entries and total for one local day (default today). Query parameter: `day`."""
    return daily.get_water_day(db, user, day or local_today(db, user))


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_water(entry_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    try:
        daily.delete_water(db, user, entry_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Water entry not found") from None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
