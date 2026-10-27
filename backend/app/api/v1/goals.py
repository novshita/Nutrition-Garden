from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.enums import CalorieTargetSource
from app.schemas.goals import CalorieTargetHistory, CalorieTargetResponse, CalorieTargetUpdate
from app.services import goals as goals_service

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("/calorie-target", response_model=CalorieTargetHistory)
def get_calorie_target(user: CurrentUser, db: DbSession) -> CalorieTargetHistory:
    return CalorieTargetHistory(
        current=goals_service.get_current_target(db, user),
        history=goals_service.get_history(db, user),
    )


@router.put("/calorie-target", response_model=CalorieTargetResponse)
def update_calorie_target(
    body: CalorieTargetUpdate, user: CurrentUser, db: DbSession
) -> CalorieTargetResponse:
    """User-reviewed change. Closes the current target and opens a new one (history is kept)."""
    if goals_service.get_current_target(db, user) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    target = goals_service.set_target(
        db, user, body.target_kcal, CalorieTargetSource.USER_ADJUSTED, body.reason
    )
    db.commit()
    return target
