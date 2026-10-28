from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.api.v1.daily_routes import ensure_not_future, or_404
from app.schemas.daily import MoodResponse, MoodUpdate
from app.services import daily

router = APIRouter(prefix="/mood", tags=["mood"])


@router.put("/{day}", response_model=MoodResponse)
def set_mood(day: date, body: MoodUpdate, user: CurrentUser, db: DbSession) -> MoodResponse:
    ensure_not_future(db, user, day)
    row = daily.set_mood(db, user, day, body)
    db.commit()
    return row


@router.get("/{day}", response_model=MoodResponse)
def get_mood(day: date, user: CurrentUser, db: DbSession) -> MoodResponse:
    return or_404(daily.get_mood(db, user, day), "mood")


@router.get("", response_model=list[MoodResponse])
def list_mood(
    user: CurrentUser,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=365, ge=1, le=1000),
) -> list[MoodResponse]:
    return daily.list_mood(db, user, start_date, end_date, limit)
