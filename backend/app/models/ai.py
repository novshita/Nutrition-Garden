import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.enums import MemoryCategory, MemoryStatus, NudgeKind


class AiMemory(Base):
    """A lasting preference. Only APPROVED memories are ever shown to the AI (engineering spec §43)."""

    __tablename__ = "ai_memory"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[MemoryCategory] = mapped_column(Enum(MemoryCategory, name="memory_category"))
    memory_text: Mapped[str] = mapped_column(Text)
    status: Mapped[MemoryStatus] = mapped_column(
        Enum(MemoryStatus, name="memory_status"), default=MemoryStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FairyNudge(Base):
    """Which gentle reminders were already shown, so each kind appears at most once a day (§48)."""

    __tablename__ = "fairy_nudge"
    __table_args__ = (UniqueConstraint("user_id", "nudge_date", "kind", name="uq_fairy_nudge"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    nudge_date: Mapped[date] = mapped_column(Date)
    kind: Mapped[NudgeKind] = mapped_column(Enum(NudgeKind, name="nudge_kind"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiUsage(Base):
    """How many AI calls a user made on a local day, for the daily limit."""

    __tablename__ = "ai_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_ai_usage"),
        CheckConstraint("calls >= 0", name="ck_ai_usage_calls"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    usage_date: Mapped[date] = mapped_column(Date)
    calls: Mapped[int] = mapped_column(Integer, default=0)
