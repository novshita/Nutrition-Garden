import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.enums import MemoryStatus
from app.schemas.ai import MemoryCreate, MemoryOut
from app.services.ai import memory as memory_service
from app.services.errors import ConflictError, NotFoundError

router = APIRouter(prefix="/memory", tags=["memory"])


def _handle(action):
    try:
        return action()
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Memory not found") from None
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None


@router.get("", response_model=list[MemoryOut])
def list_memories(
    user: CurrentUser, db: DbSession, status_filter: MemoryStatus | None = None
) -> list[MemoryOut]:
    """Your memories, newest first. Pass `status_filter` to see only pending, approved and so on."""
    return memory_service.list_memories(db, user, status_filter)


@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
def create_memory(body: MemoryCreate, user: CurrentUser, db: DbSession) -> MemoryOut:
    """Something you want remembered. Written by you, so it is approved straight away."""
    memory = _handle(
        lambda: memory_service.create_approved(db, user, body.category, body.memory_text)
    )
    out = MemoryOut.model_validate(memory)
    db.commit()
    return out


def _change(action, memory_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MemoryOut:
    memory = _handle(lambda: action(db, user, memory_id))
    out = MemoryOut.model_validate(memory)
    db.commit()
    return out


@router.post("/{memory_id}/approve", response_model=MemoryOut)
def approve_memory(memory_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MemoryOut:
    return _change(memory_service.approve, memory_id, user, db)


@router.post("/{memory_id}/reject", response_model=MemoryOut)
def reject_memory(memory_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MemoryOut:
    return _change(memory_service.reject, memory_id, user, db)


@router.post("/{memory_id}/archive", response_model=MemoryOut)
def archive_memory(memory_id: uuid.UUID, user: CurrentUser, db: DbSession) -> MemoryOut:
    return _change(memory_service.archive, memory_id, user, db)
