import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.garden import GardenItemOut, GardenOut, MilestoneOut, PlaceItem
from app.services.errors import NotFoundError
from app.services.garden import garden as service

router = APIRouter(prefix="/garden", tags=["garden"])


@router.get("", response_model=GardenOut)
def get_garden(user: CurrentUser, db: DbSession) -> GardenOut:
    out = service.get_garden(db, user)
    db.commit()  # the garden is created the first time it's opened
    return out


@router.get("/items", response_model=list[GardenItemOut])
def list_items(user: CurrentUser, db: DbSession) -> list[GardenItemOut]:
    out = service.list_items(db, user)
    db.commit()
    return out


@router.post("/items/{item_id}/place", response_model=GardenItemOut)
def place_item(
    item_id: uuid.UUID, body: PlaceItem, user: CurrentUser, db: DbSession
) -> GardenItemOut:
    """Place or move an unlocked item. The layout is saved in the database (spec §42)."""
    try:
        out = service.place_item(db, user, item_id, body.x, body.y, body.rotation)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Garden item not found") from None
    db.commit()
    return out


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(user: CurrentUser, db: DbSession) -> list[MilestoneOut]:
    out = service.list_milestones(db, user)
    db.commit()
    return out
