from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.dashboard import DayOverview
from app.services import overview
from app.services.timezone import local_today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/today", response_model=DayOverview)
def dashboard_today(user: CurrentUser, db: DbSession) -> DayOverview:
    """Today (in the user's timezone) across every tracker, plus garden progress."""
    out = overview.build_overview(db, user, local_today(db, user))
    db.commit()  # the garden is created the first time it's needed
    return out
