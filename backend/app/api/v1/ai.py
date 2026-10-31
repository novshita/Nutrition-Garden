from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUser, DbSession, get_now
from app.api.v1.food_log import save_food_log
from app.config import get_settings
from app.enums import LogSource
from app.schemas.ai import (
    AiFoodConfirm,
    AiStatus,
    ChatRequest,
    ChatResponse,
    FoodInterpretationRequest,
    FoodInterpretationResponse,
    MealRecommendationRequest,
    MealRecommendationResponse,
    MemoryOut,
    NudgeResponse,
    WeeklySummaryResponse,
)
from app.schemas.food_log import FoodLogOut
from app.services.ai import fairy, interpretation, nudge
from app.services.ai.client import (
    AiClient,
    AiInvalidOutputError,
    AiLimitError,
    AiUnavailableError,
    get_ai_client,
)
from app.services.nutrition.usda_client import UsdaClient, get_usda_client

router = APIRouter(prefix="/ai", tags=["ai"])

Ai = Annotated[AiClient, Depends(get_ai_client)]
Usda = Annotated[UsdaClient, Depends(get_usda_client)]


@contextmanager
def ai_errors() -> Iterator[None]:
    """Turn AI problems into calm, safe messages. The rest of the app is never affected."""
    try:
        yield
    except AiLimitError:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "The fairy has chatted a lot today and needs a rest. She'll be back tomorrow.",
        ) from None
    except AiUnavailableError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The fairy is resting right now. Everything else in the app still works.",
        ) from None
    except AiInvalidOutputError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "The fairy got a little muddled. Please try again."
        ) from None


@router.get("/status", response_model=AiStatus)
def ai_status(user: CurrentUser) -> AiStatus:
    """Whether AI is set up, so the interface can hide AI features if it isn't."""
    return AiStatus(available=bool(get_settings().openai_api_key))


@router.post("/food-interpretation", response_model=FoodInterpretationResponse)
def interpret_food(
    body: FoodInterpretationRequest, user: CurrentUser, db: DbSession, ai: Ai, usda: Usda
) -> FoodInterpretationResponse:
    """A proposal only. Nothing is saved here (engineering spec §21)."""
    with ai_errors():
        return interpretation.interpret(db, user, ai, usda, body.text.strip())


@router.post(
    "/food-interpretation/confirm", response_model=FoodLogOut, status_code=status.HTTP_201_CREATED
)
def confirm_food(body: AiFoodConfirm, user: CurrentUser, db: DbSession, usda: Usda) -> FoodLogOut:
    """The person reviewed the proposal and confirmed it. Needs no AI, so it works even if AI is down."""
    if body.original_text and not body.notes:
        body.notes = f"From: {body.original_text.strip()}"[:500]
    return save_food_log(body, user, db, usda, source=LogSource.AI_INTERPRETED)


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user: CurrentUser, db: DbSession, ai: Ai) -> ChatResponse:
    with ai_errors():
        reply, suggestions = fairy.chat(db, user, ai, body.message.strip(), body.history)
    out = ChatResponse(
        reply=reply, memory_suggestions=[MemoryOut.model_validate(m) for m in suggestions]
    )
    db.commit()
    return out


@router.post("/meal-recommendation", response_model=MealRecommendationResponse)
def meal_recommendation(
    body: MealRecommendationRequest, user: CurrentUser, db: DbSession, ai: Ai
) -> MealRecommendationResponse:
    with ai_errors():
        return fairy.recommend_meals(db, user, ai, body.note, body.meal_type)


@router.post("/weekly-summary", response_model=WeeklySummaryResponse)
def weekly_summary(user: CurrentUser, db: DbSession, ai: Ai) -> WeeklySummaryResponse:
    with ai_errors():
        return fairy.weekly_summary(db, user, ai)


@router.get("/nudge", response_model=NudgeResponse)
def evening_nudge(
    user: CurrentUser, db: DbSession, now: Annotated[datetime, Depends(get_now)]
) -> NudgeResponse:
    """The gentle evening reminder: at most one a day, and it doesn't use AI."""
    result = nudge.check_nudge(db, user, now)
    db.commit()
    return result
