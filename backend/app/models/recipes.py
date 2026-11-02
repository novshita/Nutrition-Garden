import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Recipe(Base):
    """A person's own recipe. Nutrition is approximate and per serving; NULL means unknown."""

    __tablename__ = "recipe"
    __table_args__ = (
        CheckConstraint("servings >= 1", name="ck_recipe_servings"),
        CheckConstraint("calories IS NULL OR calories >= 0", name="ck_recipe_calories"),
        CheckConstraint("protein_g IS NULL OR protein_g >= 0", name="ck_recipe_protein"),
        CheckConstraint("carbohydrate_g IS NULL OR carbohydrate_g >= 0", name="ck_recipe_carbs"),
        CheckConstraint("fat_g IS NULL OR fat_g >= 0", name="ck_recipe_fat"),
        CheckConstraint("fiber_g IS NULL OR fiber_g >= 0", name="ck_recipe_fiber"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    servings: Mapped[int] = mapped_column(Integer, default=1)  # how many the recipe makes
    serving_size: Mapped[str | None] = mapped_column(String(100))  # e.g. "1 bowl (about 300 g)"
    calories: Mapped[float | None] = mapped_column(Numeric(9, 2))
    protein_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    carbohydrate_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    fat_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    fiber_g: Mapped[float | None] = mapped_column(Numeric(9, 2))
    ingredients: Mapped[list] = mapped_column(JSON, default=list)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    instructions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
