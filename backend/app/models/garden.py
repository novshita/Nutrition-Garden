import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import DEFAULT_GARDEN_NAME
from app.db.base import Base
from app.enums import GrowthAction, MilestoneType


class Garden(Base):
    __tablename__ = "garden"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), unique=True
    )
    name: Mapped[str] = mapped_column(String(100), default=DEFAULT_GARDEN_NAME)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    progress: Mapped["GardenProgress"] = relationship(back_populates="garden", uselist=False)


class GardenProgress(Base):
    __tablename__ = "garden_progress"
    # Progress can only grow: there is no negative growth (spec §39).
    __table_args__ = (
        CheckConstraint("growth_points >= 0", name="ck_garden_progress_points_non_negative"),
        CheckConstraint("growth_stage >= 1", name="ck_garden_progress_stage_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("garden.id", ondelete="CASCADE"), unique=True
    )
    growth_points: Mapped[int] = mapped_column(Integer, default=0)
    growth_stage: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    garden: Mapped[Garden] = relationship(back_populates="progress")


class GardenGrowthEvent(Base):
    """Ledger of awarded growth: one row per action per local day (not in the spec's field list).

    The unique key makes growth deterministic and idempotent: re-logging, editing or deleting an
    entry can never earn the same action twice or take points back.
    """

    __tablename__ = "garden_growth_event"
    __table_args__ = (
        UniqueConstraint("garden_id", "action", "event_date", name="uq_garden_growth_event"),
        CheckConstraint("points > 0", name="ck_garden_growth_event_points_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("garden.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[GrowthAction] = mapped_column(Enum(GrowthAction, name="growth_action"))
    event_date: Mapped[date] = mapped_column(Date)
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GardenItem(Base):
    __tablename__ = "garden_item"
    __table_args__ = (UniqueConstraint("garden_id", "item_key", name="uq_garden_item_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("garden.id", ondelete="CASCADE"), index=True
    )
    item_type: Mapped[str] = mapped_column(String(30))
    item_key: Mapped[str] = mapped_column(String(60))
    # NULL position means unlocked but not placed yet. Normalised {"x": 0..1, "y": 0..1}.
    position: Mapped[dict | None] = mapped_column(JSON)
    rotation: Mapped[float | None] = mapped_column(Float)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GardenMilestone(Base):
    __tablename__ = "garden_milestone"
    __table_args__ = (
        UniqueConstraint(
            "garden_id", "milestone_type", "trigger_value", name="uq_garden_milestone"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("garden.id", ondelete="CASCADE"), index=True
    )
    milestone_type: Mapped[MilestoneType] = mapped_column(
        Enum(MilestoneType, name="milestone_type")
    )
    trigger_value: Mapped[int] = mapped_column(Integer)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
