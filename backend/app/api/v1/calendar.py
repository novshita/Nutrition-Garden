from datetime import date

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import CalendarDay, DayOverview
from app.services import calendar as calendar_service
from app.services import overview

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarDay])
def get_calendar(
    user: CurrentUser, db: DbSession, start_date: date, end_date: date
) -> list[CalendarDay]:
    """One row per local day between the dates (at most 62 days), for the calendar grid."""
    try:
        return calendar_service.build_calendar(db, user, start_date, end_date)
    except calendar_service.InvalidRangeError as exc:
        raise HTTPException(422, str(exc)) from None


@router.get("/{day}", response_model=DayOverview)
def get_calendar_day(day: date, user: CurrentUser, db: DbSession) -> DayOverview:
    """Everything recorded on one day, in the same shape as the dashboard."""
    out = overview.build_overview(db, user, day)
    db.commit()
    return out
