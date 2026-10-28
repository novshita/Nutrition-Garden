from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.api.v1.daily_routes import ensure_not_future, or_404
from app.schemas.daily import SleepResponse, SleepUpdate
from app.services import daily

router = APIRouter(prefix="/sleep", tags=["sleep"])


@router.put("/{day}", response_model=SleepResponse)
def set_sleep(day: date, body: SleepUpdate, user: CurrentUser, db: DbSession) -> SleepResponse:
    """Sleep for the night ending on local date `day` (the date you woke up)."""
    ensure_not_future(db, user, day)
    row = daily.set_sleep(db, user, day, body)
    db.commit()
    return row


@router.get("/{day}", response_model=SleepResponse)
def get_sleep(day: date, user: CurrentUser, db: DbSession) -> SleepResponse:
    return or_404(daily.get_sleep(db, user, day), "sleep")


@router.get("", response_model=list[SleepResponse])
def list_sleep(
    user: CurrentUser,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=365, ge=1, le=1000),
) -> list[SleepResponse]:
    return daily.list_sleep(db, user, start_date, end_date, limit)
