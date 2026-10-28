from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.api.v1.daily_routes import ensure_not_future, or_404
from app.schemas.daily import StepsResponse, StepsUpdate
from app.services import daily

router = APIRouter(prefix="/activity", tags=["activity"])


@router.put("/{day}", response_model=StepsResponse)
def set_steps(day: date, body: StepsUpdate, user: CurrentUser, db: DbSession) -> StepsResponse:
    """Manually entered steps for a local day; replaces any earlier value for that day."""
    ensure_not_future(db, user, day)
    row = daily.set_steps(db, user, day, body.steps)
    db.commit()
    return row


@router.get("/{day}", response_model=StepsResponse)
def get_steps(day: date, user: CurrentUser, db: DbSession) -> StepsResponse:
    return or_404(daily.get_steps(db, user, day), "steps")


@router.get("", response_model=list[StepsResponse])
def list_steps(
    user: CurrentUser,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=365, ge=1, le=1000),
) -> list[StepsResponse]:
    return daily.list_steps(db, user, start_date, end_date, limit)
