import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.enums import CalorieTargetSource


class CalorieTarget(Base):
    """Calorie target history (spec §13). Rows are never overwritten, only closed."""

    __tablename__ = "calorie_target"
    __table_args__ = (
        CheckConstraint("target_kcal > 0", name="ck_calorie_target_positive"),
        # At most one open (current) target per user.
        Index(
            "uq_calorie_target_one_open_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("effective_until IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    target_kcal: Mapped[int] = mapped_column(Integer)
    source: Mapped[CalorieTargetSource] = mapped_column(
        Enum(CalorieTargetSource, name="calorie_target_source")
    )
    reason: Mapped[str | None] = mapped_column(Text)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
