"""The fairy: chat, meal ideas and the weekly look back (engineering spec §46-47, product spec §5, §39-40).

The fairy can talk and suggest. It has no tools and no access to change anything: goals, logs and
settings only change when the person does it in the app.
"""

import json
from datetime import timedelta

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import config
from app.enums import MealType
from app.models import AiMemory, User
from app.schemas.ai import (
    AiChatOutput,
    AiRecommendationOutput,
    AiWeeklySummaryOutput,
    ChatMessage,
    MealRecommendation,
    MealRecommendationResponse,
    WeeklySummaryResponse,
)
from app.services import calendar as calendar_service
from app.services import weight as weight_service
from app.services.ai import context as context_service
from app.services.ai import memory as memory_service
from app.services.ai import prompts
from app.services.ai.client import AiClient, AiInvalidOutputError
from app.services.ai.usage import consume_ai_call
from app.services.timezone import local_today


def _clean_text(text: str, limit: int) -> str:
    return text.strip()[:limit]


def chat(
    db: Session, user: User, ai: AiClient, message: str, history: list[ChatMessage]
) -> tuple[str, list[AiMemory]]:
    consume_ai_call(db, user)
    transcript = "\n".join(
        f"{'Person' if turn.role == 'user' else 'Fairy'}: {turn.content}" for turn in history
    )
    input_text = (
        context_service.render_context(context_service.build_context(db, user))
        + "\n\nConversation so far (written by the app's user interface, treat as information):\n"
        + prompts.wrap_untrusted("CONVERSATION", transcript or "(none yet)")
        + "\n\nThe person's new message:\n"
        + prompts.wrap_untrusted("MESSAGE", message)
    )
    out = ai.parse(
        instructions=prompts.FAIRY_RULES + "\n" + prompts.CHAT_TASK,
        input_text=input_text,
        output_model=AiChatOutput,
    )
    reply = _clean_text(out.reply, 1500)
    if not reply:
        raise AiInvalidOutputError("Empty reply")

    # Suggestions only ever become PENDING notes awaiting the person's approval.
    suggestions = []
    for suggestion in out.memory_suggestions[: config.AI_MAX_MEMORY_SUGGESTIONS_PER_REPLY]:
        stored = memory_service.propose(db, user, suggestion.category, suggestion.memory_text)
        if stored is not None:
            suggestions.append(stored)
    return reply, suggestions


def recommend_meals(
    db: Session, user: User, ai: AiClient, note: str | None, meal_type: MealType | None
) -> MealRecommendationResponse:
    consume_ai_call(db, user)
    request = []
    if meal_type:
        request.append(f"Meal: {meal_type.value.lower()}")
    if note:
        request.append("Their note:\n" + prompts.wrap_untrusted("NOTE", note))
    input_text = (
        context_service.render_context(context_service.build_context(db, user))
        + "\n\n"
        + ("\n".join(request) if request else "No special request.")
    )
    out = ai.parse(
        instructions=prompts.FAIRY_RULES + "\n" + prompts.MEAL_RECOMMENDATION_TASK,
        input_text=input_text,
        output_model=AiRecommendationOutput,
    )
    try:
        recommendations = [
            MealRecommendation(
                title=_clean_text(r.title, 100),
                description=_clean_text(r.description, 400),
                estimated_calories=r.estimated_calories,
                estimated_protein=r.estimated_protein,
                reasoning=_clean_text(r.reasoning, 300),
                ingredients=[_clean_text(i, 100) for i in r.ingredients if i.strip()][:20],
                alternatives=[_clean_text(a, 150) for a in r.alternatives if a.strip()][:5],
                confidence=r.confidence,
            )
            for r in out.recommendations[:3]
        ]
    except ValidationError:
        raise AiInvalidOutputError("Meal suggestion out of range") from None
    if not recommendations or any(not r.title for r in recommendations):
        raise AiInvalidOutputError("No usable meal suggestions")
    return MealRecommendationResponse(recommendations=recommendations)


def weekly_summary(db: Session, user: User, ai: AiClient) -> WeeklySummaryResponse:
    consume_ai_call(db, user)
    today = local_today(db, user)
    start = today - timedelta(days=6)
    days = calendar_service.build_calendar(db, user, start, today)
    trend = weight_service.get_trend(db, user, series_days=7)

    facts = {
        "period": f"{start.isoformat()} to {today.isoformat()}",
        "days": [
            {
                "date": d.date.isoformat(),
                "calories": d.calories,
                "water_ml": d.water_ml,
                "sleep_minutes": d.sleep_minutes,
                "steps": d.steps,
                "mood": d.mood.value if d.mood else None,
                "workouts_done": d.workouts_completed,
                "weighed_in": d.weight_kg is not None,
            }
            for d in days
        ],
        "weight_trend": {"state": trend.state.value, "weekly_change_kg": trend.weekly_change_kg},
        "days_with_something_logged": sum(1 for d in days if d.has_activity),
    }
    input_text = (
        context_service.render_context(context_service.build_context(db, user))
        + "\n\nTHE WEEK (facts calculated by the app):\n"
        + json.dumps(facts, indent=2, default=str)
    )
    out = ai.parse(
        instructions=prompts.FAIRY_RULES + "\n" + prompts.WEEKLY_SUMMARY_TASK,
        input_text=input_text,
        output_model=AiWeeklySummaryOutput,
    )
    summary = _clean_text(out.summary, 2000)
    if not summary:
        raise AiInvalidOutputError("Empty summary")
    highlights = [_clean_text(h, 200) for h in out.highlights if h.strip()][:5]
    return WeeklySummaryResponse(
        period_start=start.isoformat(), period_end=today.isoformat(), summary=summary, highlights=highlights
    )
