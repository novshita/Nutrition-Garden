"""Long-term memory (engineering spec §43-44).

The AI can only ever *suggest* a memory, which waits as PENDING. Only the person approving it makes it
APPROVED, and only APPROVED memories are ever shown to the AI.
"""

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import config
from app.enums import MemoryCategory, MemoryStatus
from app.models import AiMemory, User
from app.services.errors import ConflictError, NotFoundError


def clean_memory_text(text: str) -> str:
    """One tidy line, no longer than the limit."""
    return re.sub(r"\s+", " ", text).strip()[: config.MAX_MEMORY_TEXT].strip()


def _count(db: Session, user: User, status: MemoryStatus) -> int:
    return (
        db.scalar(
            select(func.count(AiMemory.id)).where(AiMemory.user_id == user.id, AiMemory.status == status)
        )
        or 0
    )


def propose(db: Session, user: User, category: MemoryCategory, text: str) -> AiMemory | None:
    """Store an AI suggestion as PENDING. Skips blanks, duplicates, and a full pending list."""
    cleaned = clean_memory_text(text)
    if not cleaned:
        return None
    existing = db.scalars(
        select(AiMemory.memory_text).where(
            AiMemory.user_id == user.id,
            AiMemory.status.in_([MemoryStatus.PENDING, MemoryStatus.APPROVED]),
        )
    )
    if any(cleaned.lower() == other.lower() for other in existing):
        return None
    if _count(db, user, MemoryStatus.PENDING) >= config.MAX_PENDING_MEMORIES:
        return None
    memory = AiMemory(user_id=user.id, category=category, memory_text=cleaned, status=MemoryStatus.PENDING)
    db.add(memory)
    db.flush()
    return memory


def create_approved(db: Session, user: User, category: MemoryCategory, text: str) -> AiMemory:
    """A memory the person wrote themselves, so it is approved from the start."""
    cleaned = clean_memory_text(text)
    if not cleaned:
        raise ConflictError("A memory can't be empty")
    _require_room(db, user)
    memory = AiMemory(user_id=user.id, category=category, memory_text=cleaned, status=MemoryStatus.APPROVED)
    db.add(memory)
    db.flush()
    return memory


def _require_room(db: Session, user: User) -> None:
    if _count(db, user, MemoryStatus.APPROVED) >= config.MAX_APPROVED_MEMORIES:
        raise ConflictError("That's a lot of memories. Archive a few to make room.")


def list_memories(db: Session, user: User, status: MemoryStatus | None) -> list[AiMemory]:
    query = select(AiMemory).where(AiMemory.user_id == user.id)
    if status is not None:
        query = query.where(AiMemory.status == status)
    return list(db.scalars(query.order_by(AiMemory.created_at.desc(), AiMemory.id)))


def approved_texts(db: Session, user: User) -> list[str]:
    """The only memories the AI ever sees."""
    rows = db.scalars(
        select(AiMemory.memory_text)
        .where(AiMemory.user_id == user.id, AiMemory.status == MemoryStatus.APPROVED)
        .order_by(AiMemory.updated_at.desc())
        .limit(config.AI_CONTEXT_MEMORY_LIMIT)
    )
    return list(rows)


def _owned(db: Session, user: User, memory_id: uuid.UUID) -> AiMemory:
    memory = db.scalar(select(AiMemory).where(AiMemory.id == memory_id, AiMemory.user_id == user.id))
    if memory is None:
        raise NotFoundError
    return memory


def _transition(
    db: Session, user: User, memory_id: uuid.UUID, allowed: set[MemoryStatus], to: MemoryStatus
) -> AiMemory:
    memory = _owned(db, user, memory_id)
    if memory.status not in allowed:
        raise ConflictError("That memory can't be changed that way")
    if to == MemoryStatus.APPROVED:
        _require_room(db, user)
    memory.status = to
    db.flush()
    return memory


def approve(db: Session, user: User, memory_id: uuid.UUID) -> AiMemory:
    return _transition(db, user, memory_id, {MemoryStatus.PENDING}, MemoryStatus.APPROVED)


def reject(db: Session, user: User, memory_id: uuid.UUID) -> AiMemory:
    return _transition(db, user, memory_id, {MemoryStatus.PENDING}, MemoryStatus.REJECTED)


def archive(db: Session, user: User, memory_id: uuid.UUID) -> AiMemory:
    return _transition(db, user, memory_id, {MemoryStatus.APPROVED}, MemoryStatus.ARCHIVED)
