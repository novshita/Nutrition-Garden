"""Food search and lookup with a local cache so the app survives USDA outages (spec §19, §66)."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import USDA_CACHE_TTL_DAYS
from app.models import UsdaFoodCache
from app.schemas.nutrition import FoodDetailResponse, FoodItem, FoodSearchResponse
from app.services.nutrition.usda_client import UsdaClient, UsdaUnavailableError
from app.services.nutrition.usda_normalizer import normalize_food

logger = logging.getLogger(__name__)

GENERIC_DATA_TYPES = ["Foundation", "SR Legacy"]
BRANDED_DATA_TYPE = "Branded"


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_foods(
    db: Session,
    client: UsdaClient,
    query: str,
    page: int,
    page_size: int,
    include_branded: bool,
) -> FoodSearchResponse:
    data_types = GENERIC_DATA_TYPES + ([BRANDED_DATA_TYPE] if include_branded else [])
    try:
        raw = client.search(query, page, page_size, data_types)
        foods = [normalize_food(item) for item in raw.get("foods", []) if "fdcId" in item]
        return FoodSearchResponse(
            query=query,
            page=int(raw.get("currentPage", page)),
            total_hits=int(raw.get("totalHits", len(foods))),
            total_pages=int(raw.get("totalPages", 1)),
            results=foods,
            source="usda",
        )
    except (UsdaUnavailableError, KeyError, TypeError, ValueError):
        logger.warning("USDA search unavailable; falling back to cached foods")
        return _search_cache(db, query, page, page_size)


def _search_cache(db: Session, query: str, page: int, page_size: int) -> FoodSearchResponse:
    pattern = f"%{_escape_like(query)}%"
    where = UsdaFoodCache.name.ilike(pattern, escape="\\")
    rows = list(
        db.scalars(
            select(UsdaFoodCache)
            .where(where)
            .order_by(UsdaFoodCache.last_accessed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    total = db.scalar(select(func.count(UsdaFoodCache.id)).where(where)) or 0
    return FoodSearchResponse(
        query=query,
        page=page,
        total_hits=total,
        total_pages=max(1, -(-total // page_size)),
        results=[FoodItem.model_validate(row.data_json) for row in rows],
        source="cache",
    )


def get_food(db: Session, client: UsdaClient, fdc_id: int) -> FoodDetailResponse:
    """Fresh cache first, then USDA. A stale cached copy is used if USDA is down.

    Raises UsdaNotFoundError for unknown ids and UsdaUnavailableError if USDA is down and the
    food was never cached.
    """
    now = datetime.now(UTC)
    cached = db.scalar(select(UsdaFoodCache).where(UsdaFoodCache.fdc_id == fdc_id))
    if cached is not None and cached.fetched_at > now - timedelta(days=USDA_CACHE_TTL_DAYS):
        cached.last_accessed_at = now
        db.flush()
        return FoodDetailResponse(
            food=FoodItem.model_validate(cached.data_json), source="cache", stale=False
        )

    try:
        food = normalize_food(client.get_food(fdc_id))
    except UsdaUnavailableError:
        if cached is None:
            raise
        logger.warning("USDA unavailable; serving stale cached food %s", fdc_id)
        return FoodDetailResponse(
            food=FoodItem.model_validate(cached.data_json), source="cache", stale=True
        )

    _store(db, food, cached, now)
    return FoodDetailResponse(food=food, source="usda", stale=False)


def _store(db: Session, food: FoodItem, existing: UsdaFoodCache | None, now: datetime) -> None:
    payload = food.model_dump(mode="json")
    if existing is not None:
        existing.name, existing.data_json = food.name[:500], payload
        existing.fetched_at = existing.last_accessed_at = now
        db.flush()
        return
    try:
        with db.begin_nested():  # a concurrent request may have inserted the same food
            db.add(
                UsdaFoodCache(
                    fdc_id=food.fdc_id,
                    name=food.name[:500],
                    data_json=payload,
                    fetched_at=now,
                    last_accessed_at=now,
                )
            )
    except IntegrityError:
        logger.info("Food %s was cached concurrently", food.fdc_id)
