import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import FoodSource, LogSource, MealType


class FoodLog(Base):
    __tablename__ = "food_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    meal_type: Mapped[MealType] = mapped_column(Enum(MealType, name="meal_type"))
    source: Mapped[LogSource] = mapped_column(Enum(LogSource, name="log_source"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["FoodLogItem"]] = relationship(
        back_populates="food_log",
        cascade="all, delete-orphan",
        order_by="FoodLogItem.position",
    )


class FoodLogItem(Base):
    """One food in a log. Nutrition values are snapshots for the logged amount (spec §17).

    NULL means unknown and is never treated as zero (spec §23).
    """

    __tablename__ = "food_log_item"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_food_log_item_quantity_positive"),
        CheckConstraint("calories IS NULL OR calories >= 0", name="ck_food_log_item_calories"),
        CheckConstraint("protein_g IS NULL OR protein_g >= 0", name="ck_food_log_item_protein"),
        CheckConstraint(
            "carbohydrate_g IS NULL OR carbohydrate_g >= 0", name="ck_food_log_item_carbs"
        ),
        CheckConstraint("fat_g IS NULL OR fat_g >= 0", name="ck_food_log_item_fat"),
        CheckConstraint("fiber_g IS NULL OR fiber_g >= 0", name="ck_food_log_item_fiber"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    food_log_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("food_log.id", ondelete="CASCADE"), index=True
    )
    # Display order within the log (not in the spec's field list; needed for a stable order).
    position: Mapped[int] = mapped_column(Integer, default=0)
    food_source: Mapped[FoodSource] = mapped_column(Enum(FoodSource, name="food_source"))
    external_food_id: Mapped[str | None] = mapped_column(String(64))
    food_name: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2))
    unit: Mapped[str] = mapped_column(String(100))
    # Grams in one `unit`; NULL for custom foods whose nutrition was entered directly.
    serving_size: Mapped[float | None] = mapped_column(Numeric(10, 2))
    calories: Mapped[float | None] = mapped_column(Numeric(9, 2))
    protein_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    carbohydrate_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    fat_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    fiber_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    micronutrients_json: Mapped[dict | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    food_log: Mapped[FoodLog] = relationship(back_populates="items")
