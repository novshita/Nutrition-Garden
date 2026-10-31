"""AI schemas.

Two layers on purpose. The `Ai...Output` models are what the model is asked to produce; they carry no
numeric limits because strict structured output rejects many of them. Everything the model returns is
then checked and cleaned by our own code (services/ai) into the validated models below, so a bad answer
can never reach the person or the database (engineering spec §20).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from app.config import AI_MAX_CHAT_HISTORY, AI_MAX_CHAT_MESSAGE, AI_MAX_FOOD_TEXT, MAX_MEMORY_TEXT
from app.enums import MealType, MemoryCategory, MemoryStatus
from app.schemas.food_log import FoodLogCreate
from app.schemas.nutrition import FoodItem

# What the model is asked to produce ------------------------------------------------------------


class AiInterpretedItem(BaseModel):
    food_name: str
    quantity: float | None
    unit: str | None
    preparation_method: str | None
    confidence: float


class AiFoodInterpretationOutput(BaseModel):
    items: list[AiInterpretedItem]
    meal_context: str | None
    assumptions: list[str]
    needs_clarification: bool
    clarification_question: str | None


class AiMemorySuggestion(BaseModel):
    category: MemoryCategory
    memory_text: str


class AiChatOutput(BaseModel):
    reply: str
    memory_suggestions: list[AiMemorySuggestion]


class AiMealRecommendation(BaseModel):
    title: str
    description: str
    estimated_calories: int
    estimated_protein: float | None
    reasoning: str
    ingredients: list[str]
    alternatives: list[str]
    confidence: float


class AiRecommendationOutput(BaseModel):
    recommendations: list[AiMealRecommendation]


class AiWeeklySummaryOutput(BaseModel):
    summary: str
    highlights: list[str]


# What the API accepts and returns ---------------------------------------------------------------


def _not_blank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("This can't be empty")
    return value


class FoodInterpretationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=AI_MAX_FOOD_TEXT)

    _trimmed = field_validator("text")(_not_blank)


class InterpretedItem(BaseModel):
    food_name: str
    quantity: float | None
    unit: str | None
    preparation_method: str | None
    confidence: float


class FoodInterpretation(BaseModel):
    """A proposal. Nothing is saved until the person reviews and confirms it (engineering spec §21)."""

    items: list[InterpretedItem]
    meal_context: str | None
    assumptions: list[str]
    needs_clarification: bool
    clarification_question: str | None


class ItemMatches(BaseModel):
    """Database matches for one interpreted food, to help the person pick what they ate."""

    food_name: str
    source: Literal["usda", "cache"]
    matches: list[FoodItem]


class FoodInterpretationResponse(BaseModel):
    interpretation: FoodInterpretation
    lookups: list[ItemMatches]


class AiFoodConfirm(FoodLogCreate):
    """The reviewed items, sent back by the person. Only this endpoint can turn a proposal into a log."""

    confirmed: StrictBool  # must be exactly true; 1, "yes" and the like don't count
    original_text: str | None = Field(default=None, max_length=AI_MAX_FOOD_TEXT)

    @field_validator("confirmed")
    @classmethod
    def _must_be_true(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("The proposal must be confirmed")
        return value


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=AI_MAX_CHAT_MESSAGE)

    _trimmed = field_validator("content")(_not_blank)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=AI_MAX_CHAT_MESSAGE)

    _trimmed = field_validator("message")(_not_blank)
    history: list[ChatMessage] = Field(default_factory=list, max_length=AI_MAX_CHAT_HISTORY)


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: MemoryCategory
    memory_text: str
    status: MemoryStatus
    created_at: datetime


class ChatResponse(BaseModel):
    reply: str
    # Pending only: nothing is remembered until the person approves it.
    memory_suggestions: list[MemoryOut]


class MealRecommendationRequest(BaseModel):
    note: str | None = Field(default=None, max_length=300)
    meal_type: MealType | None = None

    @field_validator("note")
    @classmethod
    def _blank_note_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class MealRecommendation(BaseModel):
    title: str
    description: str
    estimated_calories: int = Field(ge=0, le=3000)
    estimated_protein: float | None = Field(default=None, ge=0, le=300)
    reasoning: str
    ingredients: list[str]
    alternatives: list[str]
    confidence: float = Field(ge=0, le=1)


class MealRecommendationResponse(BaseModel):
    recommendations: list[MealRecommendation]
    note: str = "These are suggestions with rough estimates. You decide what to eat."


class WeeklySummaryResponse(BaseModel):
    period_start: str
    period_end: str
    summary: str
    highlights: list[str]


class MemoryCreate(BaseModel):
    category: MemoryCategory
    memory_text: str = Field(min_length=1, max_length=MAX_MEMORY_TEXT)

    _trimmed = field_validator("memory_text")(_not_blank)


class NudgeResponse(BaseModel):
    show: bool
    message: str | None = None


class AiStatus(BaseModel):
    available: bool
