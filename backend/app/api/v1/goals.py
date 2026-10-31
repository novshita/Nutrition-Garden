from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.enums import CalorieTargetSource
from app.schemas.goals import (
    AcceptSuggestion,
    CalorieSuggestionOut,
    CalorieTargetHistory,
    CalorieTargetResponse,
    CalorieTargetUpdate,
)
from app.services import adaptive as adaptive_service
from app.services import goals as goals_service
from app.services.errors import ConflictError

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


@router.get("/calorie-target/suggestion", response_model=CalorieSuggestionOut)
def get_calorie_suggestion(user: CurrentUser, db: DbSession) -> CalorieSuggestionOut:
    """A read-only look at whether the weight trend suggests reviewing the target (spec §14)."""
    try:
        return adaptive_service.get_suggestion(db, user)
    except adaptive_service.NoTargetError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first") from None


@router.post("/calorie-target/suggestion/accept", response_model=CalorieTargetResponse)
def accept_calorie_suggestion(
    body: AcceptSuggestion, user: CurrentUser, db: DbSession
) -> CalorieTargetResponse:
    """Apply a suggestion the user has seen. The target must equal the current suggestion."""
    try:
        target = adaptive_service.accept_suggestion(db, user, body.target_kcal)
    except adaptive_service.NoTargetError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first") from None
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None
    db.commit()
    return target
