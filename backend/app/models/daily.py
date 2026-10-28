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

from app.config import SLEEP_QUALITY_MAX, SLEEP_QUALITY_MIN
from app.db.base import Base
from app.enums import Mood


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)


class WaterLog(Base):
    __tablename__ = "water_log"
    __table_args__ = (CheckConstraint("amount_ml >= 0", name="ck_water_log_amount_non_negative"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = _user_fk()
    consumed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    amount_ml: Mapped[int] = mapped_column(Integer)


class DailyActivity(Base):
    """Manually entered steps, one row per user per local day (spec §31)."""

    __tablename__ = "daily_activity"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_activity_user_date"),
        CheckConstraint("steps >= 0", name="ck_daily_activity_steps_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = _user_fk()
    date: Mapped[date] = mapped_column(Date)
    steps: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SleepLog(Base):
    """One row per user per sleep_date (the local date of waking up)."""

    __tablename__ = "sleep_log"
    __table_args__ = (
        UniqueConstraint("user_id", "sleep_date", name="uq_sleep_log_user_date"),
        CheckConstraint("duration_minutes > 0", name="ck_sleep_log_duration_positive"),
        CheckConstraint(
            f"quality IS NULL OR quality BETWEEN {SLEEP_QUALITY_MIN} AND {SLEEP_QUALITY_MAX}",
            name="ck_sleep_log_quality_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = _user_fk()
    sleep_date: Mapped[date] = mapped_column(Date)
    bedtime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    wake_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    quality: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)


class MoodLog(Base):
    __tablename__ = "mood_log"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_mood_log_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = _user_fk()
    date: Mapped[date] = mapped_column(Date)
    mood: Mapped[Mood] = mapped_column(Enum(Mood, name="mood"))
    note: Mapped[str | None] = mapped_column(Text)
