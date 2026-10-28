from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.nutrition import FoodDetailResponse, FoodSearchResponse
from app.services.nutrition import food_service
from app.services.nutrition.usda_client import (
    UsdaClient,
    UsdaNotFoundError,
    UsdaUnavailableError,
    get_usda_client,
)

router = APIRouter(prefix="/food", tags=["food"])

Usda = Annotated[UsdaClient, Depends(get_usda_client)]


@router.get("/search", response_model=FoodSearchResponse)
def search_food(
    user: CurrentUser,
    db: DbSession,
    usda: Usda,
    query: Annotated[str, Query(min_length=2, max_length=100)],
    page: Annotated[int, Query(ge=1, le=100)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 25,
    include_branded: bool = False,
) -> FoodSearchResponse:
    """Search USDA. If USDA is unreachable, `source` is "cache" and only known foods are listed."""
    result = food_service.search_foods(db, usda, query.strip(), page, page_size, include_branded)
    db.commit()
    return result


@router.get("/{fdc_id}", response_model=FoodDetailResponse)
def get_food(
    fdc_id: Annotated[int, Path(gt=0)], user: CurrentUser, db: DbSession, usda: Usda
) -> FoodDetailResponse:
    try:
        result = food_service.get_food(db, usda, fdc_id)
    except UsdaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Food not found") from None
    except UsdaUnavailableError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The food database is temporarily unavailable. You can retry or enter the food manually.",
        ) from None
    db.commit()
    return result
