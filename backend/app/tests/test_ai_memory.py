import uuid

import pytest
from sqlalchemy import select

from app import config
from app.enums import MemoryStatus
from app.models import AiMemory
from app.schemas.ai import AiChatOutput
from app.tests.ai_helpers import chat_output, login, signup, suggestion

CHAT = "/api/v1/ai/chat"
MEMORY = "/api/v1/memory"


def talk(client, ai, *suggestions, message="I love peanut butter toast"):
    ai.outputs[AiChatOutput] = chat_output("Noted, lovely.", list(suggestions))
    r = client.post(CHAT, json={"message": message})
    assert r.status_code == 200, r.text
    return r.json()


def memories(client, status=None):
    params = {"status_filter": status} if status else {}
    return client.get(MEMORY, params=params).json()


def only(client):
    [memory] = memories(client)
    return memory


def act(client, memory_id, action):
    return client.post(f"{MEMORY}/{memory_id}/{action}")


def test_requires_authentication(client, ai):
    assert client.get(MEMORY).status_code == 401
    assert client.post(MEMORY, json={"category": "OTHER", "memory_text": "x"}).status_code == 401
    assert act(client, uuid.uuid4(), "approve").status_code == 401


# Mandatory business-logic test #3 ------------------------------------------------------------


def test_the_ai_cannot_make_a_memory_real(client, ai, db):
    signup(client)
    body = talk(client, ai, suggestion("Loves peanut butter on toast"))
    # It's only a suggestion, waiting for the person.
    assert [m["status"] for m in body["memory_suggestions"]] == ["PENDING"]
    assert len(memories(client)) == 1
    assert memories(client, "APPROVED") == []
    assert db.scalars(select(AiMemory).where(AiMemory.status == MemoryStatus.APPROVED)).all() == []

    # And a pending suggestion is never shown to the AI.
    talk(client, ai, message="what should I eat?")
    assert "peanut butter" not in ai.last_input.lower()


def test_only_approved_memories_reach_the_ai(client, ai):
    signup(client)
    talk(client, ai, suggestion("Loves peanut butter on toast"), suggestion("Dislikes mushrooms", "FOOD_DISLIKE"))
    pending = memories(client)
    peanut = next(m for m in pending if "peanut" in m["memory_text"])
    mushrooms = next(m for m in pending if "mushrooms" in m["memory_text"])

    assert act(client, peanut["id"], "approve").status_code == 200
    assert act(client, mushrooms["id"], "reject").status_code == 200
    talk(client, ai, message="hi")
    assert "Loves peanut butter on toast" in ai.last_input
    assert "mushrooms" not in ai.last_input

    assert act(client, peanut["id"], "archive").status_code == 200  # forgotten again
    talk(client, ai, message="hi again")
    assert "peanut butter" not in ai.last_input.lower()


def test_the_model_has_no_way_to_set_a_status(client, ai):
    """The suggestion shape carries only a category and text, so there is nothing to approve with."""
    assert set(suggestion().model_dump()) == {"category", "memory_text"}
    signup(client)
    talk(client, ai, suggestion())
    assert only(client)["status"] == "PENDING"


# Reviewing suggestions -----------------------------------------------------------------------


def test_person_approves_rejects_and_archives(client, ai):
    signup(client)
    talk(client, ai, suggestion("Likes oats"))
    memory = only(client)
    approved = act(client, memory["id"], "approve")
    assert approved.status_code == 200 and approved.json()["status"] == "APPROVED"
    assert act(client, memory["id"], "archive").json()["status"] == "ARCHIVED"

    talk(client, ai, suggestion("Dislikes mushrooms", "FOOD_DISLIKE"))
    new = next(m for m in memories(client, "PENDING"))
    assert act(client, new["id"], "reject").json()["status"] == "REJECTED"


@pytest.mark.parametrize(
    "start,action",
    [("PENDING", "archive"), ("APPROVED", "approve"), ("APPROVED", "reject"), ("REJECTED", "approve"), ("ARCHIVED", "approve")],
)
def test_changes_that_make_no_sense_are_refused(client, ai, start, action):
    signup(client)
    talk(client, ai, suggestion("Likes oats"))
    memory = only(client)
    if start == "APPROVED":
        act(client, memory["id"], "approve")
    elif start == "REJECTED":
        act(client, memory["id"], "reject")
    elif start == "ARCHIVED":
        act(client, memory["id"], "approve")
        act(client, memory["id"], "archive")
    assert act(client, memory["id"], action).status_code == 409
    assert only(client)["status"] == start


def test_people_can_write_their_own_memory_which_is_approved_at_once(client, ai):
    signup(client)
    r = client.post(MEMORY, json={"category": "ROUTINE", "memory_text": "  Walks after   dinner "})
    assert r.status_code == 201
    assert r.json()["status"] == "APPROVED" and r.json()["memory_text"] == "Walks after dinner"
    talk(client, ai, message="hi")
    assert "Walks after dinner" in ai.last_input


@pytest.mark.parametrize("text", ["", "   ", "x" * 201])
def test_own_memory_must_be_a_sensible_length(client, ai, text):
    signup(client)
    assert client.post(MEMORY, json={"category": "OTHER", "memory_text": text}).status_code == 422


# Keeping it limited --------------------------------------------------------------------------


def test_duplicates_blanks_and_extras_are_not_stored(client, ai):
    signup(client)
    talk(client, ai, suggestion("Likes oats"), suggestion("  likes   OATS "), suggestion("   "))
    assert len(memories(client)) == 1
    talk(client, ai, suggestion("Likes oats"))  # already pending
    assert len(memories(client)) == 1
    talk(client, ai, *[suggestion(f"Fact number {i}") for i in range(8)])
    assert len(memories(client)) == 1 + 3  # at most three suggestions per reply


def test_suggestion_text_is_tidied(client, ai):
    signup(client)
    talk(client, ai, suggestion("Loves\n\n  toast\twith   jam " + "x" * 300))
    text = only(client)["memory_text"]
    assert "\n" not in text and "  " not in text and len(text) <= config.MAX_MEMORY_TEXT


def test_pending_list_is_capped(client, ai, monkeypatch):
    monkeypatch.setattr(config, "MAX_PENDING_MEMORIES", 2)
    signup(client)
    talk(client, ai, suggestion("One"), suggestion("Two"), suggestion("Three"))
    assert len(memories(client, "PENDING")) == 2


def test_approved_memories_are_limited(client, ai, monkeypatch):
    monkeypatch.setattr(config, "MAX_APPROVED_MEMORIES", 1)
    signup(client)
    talk(client, ai, suggestion("One"), suggestion("Two"))
    first, second = memories(client)
    assert act(client, first["id"], "approve").status_code == 200
    r = act(client, second["id"], "approve")
    assert r.status_code == 409 and "Archive" in r.json()["detail"]
    assert client.post(MEMORY, json={"category": "OTHER", "memory_text": "Three"}).status_code == 409
    act(client, first["id"], "archive")  # making room works
    assert act(client, second["id"], "approve").status_code == 200


def test_the_ai_sees_a_limited_number_of_notes(client, ai, monkeypatch):
    monkeypatch.setattr(config, "AI_CONTEXT_MEMORY_LIMIT", 3)
    signup(client)
    for i in range(6):
        client.post(MEMORY, json={"category": "OTHER", "memory_text": f"Note {i}"})
    talk(client, ai, message="hi")
    assert sum(f"Note {i}" in ai.last_input for i in range(6)) == 3


# Privacy -------------------------------------------------------------------------------------


def test_memories_are_private(client, ai):
    signup(client, "a@example.com")
    talk(client, ai, suggestion("Likes oats"))
    mine = only(client)
    signup(client, "b@example.com")
    assert memories(client) == []
    for action in ("approve", "reject", "archive"):
        assert act(client, mine["id"], action).status_code == 404
    talk(client, ai, message="hi")
    assert "oats" not in ai.last_input
    login(client, "a@example.com")
    assert only(client)["status"] == "PENDING"  # untouched by the other person's attempts


def test_unknown_memory_id(client, ai):
    signup(client)
    assert act(client, uuid.uuid4(), "approve").status_code == 404
    assert client.post(f"{MEMORY}/not-a-uuid/approve").status_code == 422
