from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models import UserProfile
from app.schemas.weight import BmiResponse
from app.services import weight as weight_service
from app.services.calculations import body

router = APIRouter(prefix="/bmi", tags=["bmi"])


@router.get("", response_model=BmiResponse)
def get_bmi(user: CurrentUser, db: DbSession) -> BmiResponse:
    """BMI from the latest weight and stored height. Derived, never stored (spec §8)."""
    height = db.scalar(select(UserProfile.height_cm).where(UserProfile.user_id == user.id))
    latest = weight_service.get_latest(db, user)
    if height is None or latest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Height and weight are required")
    weight_kg, height_cm = float(latest.weight_kg), float(height)
    return BmiResponse(
        bmi=round(body.bmi(weight_kg, height_cm), 1), weight_kg=weight_kg, height_cm=height_cm
    )
