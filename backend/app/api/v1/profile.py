from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.profile import ProfileCreate, ProfileSummary
from app.services import profile as profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("", response_model=ProfileSummary, status_code=status.HTTP_201_CREATED)
def create_profile(body: ProfileCreate, user: CurrentUser, db: DbSession) -> ProfileSummary:
    try:
        summary = profile_service.create_profile(db, user, body)
    except profile_service.ProfileExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Profile already exists") from None
    db.commit()
    return summary


@router.get("", response_model=ProfileSummary)
def get_profile(user: CurrentUser, db: DbSession) -> ProfileSummary:
    summary = profile_service.get_summary(db, user)
    if summary is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return summary
