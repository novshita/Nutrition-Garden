from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.weight import TrendResponse, WeightCreate, WeightResponse
from app.services import weight as weight_service

router = APIRouter(prefix="/weight", tags=["weight"])


@router.post("", response_model=WeightResponse, status_code=status.HTTP_201_CREATED)
def log_weight(body: WeightCreate, user: CurrentUser, db: DbSession) -> WeightResponse:
    log = weight_service.add_weight(db, user, body.weight_kg, body.recorded_at, body.note)
    db.commit()
    return log


@router.get("", response_model=list[WeightResponse])
def list_weight(
    user: CurrentUser,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=365, ge=1, le=1000),
) -> list[WeightResponse]:
    return weight_service.list_weights(db, user, start_date, end_date, limit)


@router.get("/trend", response_model=TrendResponse)
def weight_trend(
    user: CurrentUser, db: DbSession, series_days: int = Query(default=90, ge=1, le=730)
) -> TrendResponse:
    return weight_service.get_trend(db, user, series_days)
