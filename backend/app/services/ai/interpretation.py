"""Natural-language food entry (engineering spec §20-21, product spec §13-14).

The AI proposes; nothing here saves anything. The person reviews the proposal and confirms it through
a separate endpoint, which does the nutrition lookup and creates the log.
"""

import math

from sqlalchemy.orm import Session

from app import config
from app.models import User
from app.schemas.ai import (
    AiFoodInterpretationOutput,
    FoodInterpretation,
    FoodInterpretationResponse,
    InterpretedItem,
    ItemMatches,
)
from app.services.ai import prompts
from app.services.ai.client import AiClient, AiInvalidOutputError
from app.services.ai.usage import consume_ai_call
from app.services.nutrition import food_service
from app.services.nutrition.usda_client import UsdaClient

MAX_ITEMS = 20


def _clean_number(value: float | None, high: float) -> float | None:
    if value is None or not math.isfinite(value) or value <= 0 or value > high:
        return None
    return round(value, 3)


def normalize(raw: AiFoodInterpretationOutput) -> FoodInterpretation:
    """Our own checks on what the model said. A missing amount is never filled in or guessed."""
    items: list[InterpretedItem] = []
    for item in raw.items[:MAX_ITEMS]:
        name = " ".join(item.food_name.split())[:100]
        if not name:
            continue
        confidence = item.confidence if math.isfinite(item.confidence) else 0.0
        unit = " ".join((item.unit or "").split())[:50] or None
        method = " ".join((item.preparation_method or "").split())[:100] or None
        items.append(
            InterpretedItem(
                food_name=name,
                quantity=_clean_number(item.quantity, 100_000),
                unit=unit,
                preparation_method=method,
                confidence=min(1.0, max(0.0, confidence)),
            )
        )

    assumptions = [" ".join(a.split())[:200] for a in raw.assumptions if a.strip()][:10]
    question = " ".join((raw.clarification_question or "").split())[:300] or None
    needs = raw.needs_clarification

    if not items:
        needs = True
        question = question or "What did you eat? You can tell me in your own words."
    incomplete = [i for i in items if i.quantity is None or i.unit is None]
    if incomplete:
        # Ask rather than invent (product spec §14).
        needs = True
        question = question or f"How much {incomplete[0].food_name} did you have?"
    if needs and question is None:
        question = "Could you tell me a little more about what you ate?"
    if not needs:
        question = None

    meal_context = " ".join((raw.meal_context or "").split())[:100] or None
    return FoodInterpretation(
        items=items,
        meal_context=meal_context,
        assumptions=assumptions,
        needs_clarification=needs,
        clarification_question=question,
    )


def interpret(
    db: Session, user: User, ai: AiClient, usda: UsdaClient, text: str
) -> FoodInterpretationResponse:
    consume_ai_call(db, user)
    raw = ai.parse(
        instructions=prompts.FAIRY_RULES + "\n" + prompts.FOOD_INTERPRETATION_TASK,
        input_text="What the person typed:\n" + prompts.wrap_untrusted("FOOD_TEXT", text),
        output_model=AiFoodInterpretationOutput,
    )
    interpretation = normalize(raw)

    # Database matches help the person pick what they actually ate. If USDA is down this falls back
    # to foods they've used before, and never blocks the proposal.
    lookups = []
    for item in interpretation.items[: config.AI_FOOD_LOOKUP_ITEMS]:
        found = food_service.search_foods(
            db, usda, item.food_name, 1, config.AI_FOOD_MATCHES_PER_ITEM, include_branded=False
        )
        lookups.append(ItemMatches(food_name=item.food_name, source=found.source, matches=found.results))
    if not isinstance(interpretation, FoodInterpretation):  # pragma: no cover - defensive
        raise AiInvalidOutputError("Unexpected interpretation")
    return FoodInterpretationResponse(interpretation=interpretation, lookups=lookups)
