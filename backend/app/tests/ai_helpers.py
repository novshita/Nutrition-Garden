from app.schemas.ai import (
    AiChatOutput,
    AiFoodInterpretationOutput,
    AiInterpretedItem,
    AiMealRecommendation,
    AiMemorySuggestion,
    AiRecommendationOutput,
    AiWeeklySummaryOutput,
)


def signup(client, email="rose@example.com", name="Rose Garden"):
    client.cookies.clear()
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse", "display_name": name},
    )
    assert r.status_code == 201, r.text


def login(client, email):
    client.cookies.clear()
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "correct-horse"}
    ).status_code == 200


def onboard(client, tz="UTC"):
    r = client.post(
        "/api/v1/profile",
        json={
            "date_of_birth": "2000-01-01",
            "sex": "FEMALE",
            "height_cm": 165,
            "weight_kg": 50,
            "goal_weight_kg": 56,
            "preferred_unit_system": "METRIC",
            "activity_level": "LIGHT",
            "timezone": tz,
        },
    )
    assert r.status_code == 201, r.text


def eat(client, calories, **extra):
    r = client.post(
        "/api/v1/food/log",
        json={
            "meal_type": "LUNCH",
            "items": [
                {"food_source": "CUSTOM", "food_name": "Meal", "quantity": 1, "unit": "plate", "calories": calories}
            ],
            **extra,
        },
    )
    assert r.status_code == 201, r.text


def item(name="egg", quantity=2.0, unit="egg", confidence=0.9, method=None):
    return AiInterpretedItem(
        food_name=name, quantity=quantity, unit=unit, preparation_method=method, confidence=confidence
    )


def interpretation(items=None, needs=False, question=None, assumptions=None, context=None):
    return AiFoodInterpretationOutput(
        items=[item()] if items is None else items,
        meal_context=context,
        assumptions=assumptions or [],
        needs_clarification=needs,
        clarification_question=question,
    )


def chat_output(reply="Hello, lovely.", suggestions=None):
    return AiChatOutput(reply=reply, memory_suggestions=suggestions or [])


def suggestion(text="Loves peanut butter on toast", category="FOOD_LIKE"):
    return AiMemorySuggestion(category=category, memory_text=text)


def meal(title="Peanut butter toast", calories=450, protein=15.0, confidence=0.7, **extra):
    base = {
        "title": title,
        "description": "Two slices with peanut butter.",
        "estimated_calories": calories,
        "estimated_protein": protein,
        "reasoning": "Easy and filling.",
        "ingredients": ["bread", "peanut butter"],
        "alternatives": ["almond butter"],
        "confidence": confidence,
    }
    base.update(extra)
    return AiMealRecommendation(**base)


def recommendations(*meals):
    return AiRecommendationOutput(recommendations=list(meals) or [meal()])


def weekly(summary="A gentle week.", highlights=None):
    return AiWeeklySummaryOutput(summary=summary, highlights=highlights or ["You logged water often."])
