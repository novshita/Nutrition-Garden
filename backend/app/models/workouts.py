import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import Difficulty, ExerciseCategory, ExerciseType, Weekday


class WorkoutTemplate(Base):
    __tablename__ = "workout_template"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, name="difficulty"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="WorkoutExercise.order_index"
    )


class WorkoutExercise(Base):
    __tablename__ = "workout_exercise"
    __table_args__ = (
        CheckConstraint("default_sets >= 1", name="ck_workout_exercise_sets"),
        CheckConstraint("default_reps IS NULL OR default_reps > 0", name="ck_workout_exercise_reps"),
        CheckConstraint(
            "default_duration_seconds IS NULL OR default_duration_seconds > 0",
            name="ck_workout_exercise_duration",
        ),
        CheckConstraint("rest_seconds >= 0", name="ck_workout_exercise_rest"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_template.id", ondelete="CASCADE"), index=True
    )
    exercise_name: Mapped[str] = mapped_column(String(100))
    exercise_type: Mapped[ExerciseType] = mapped_column(Enum(ExerciseType, name="exercise_type"))
    # Not in the spec's field list; §26 defines categories but no column holds them.
    category: Mapped[ExerciseCategory] = mapped_column(
        Enum(ExerciseCategory, name="exercise_category")
    )
    order_index: Mapped[int] = mapped_column(Integer)
    default_sets: Mapped[int] = mapped_column(Integer, default=1)
    default_reps: Mapped[int | None] = mapped_column(Integer)
    default_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    rest_seconds: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped[WorkoutTemplate] = relationship(back_populates="exercises")


class WorkoutSchedule(Base):
    __tablename__ = "workout_schedule"
    __table_args__ = (
        UniqueConstraint("user_id", "weekday", name="uq_workout_schedule_user_weekday"),
        CheckConstraint(
            "(is_rest_day AND template_id IS NULL) OR (NOT is_rest_day AND template_id IS NOT NULL)",
            name="ck_workout_schedule_rest_or_template",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    weekday: Mapped[Weekday] = mapped_column(Enum(Weekday, name="weekday"))
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workout_template.id", ondelete="CASCADE")
    )
    is_rest_day: Mapped[bool] = mapped_column(Boolean, default=False)

    template: Mapped[WorkoutTemplate | None] = relationship()


class WorkoutSession(Base):
    __tablename__ = "workout_session"
    __table_args__ = (CheckConstraint("duration_seconds > 0", name="ck_workout_session_duration"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workout_template.id", ondelete="SET NULL")
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(Integer)
    # An estimate only. NULL when it can't be estimated; never feeds the calorie target.
    estimated_calories: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    template: Mapped[WorkoutTemplate | None] = relationship()
    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.set_number",
    )


class WorkoutSet(Base):
    __tablename__ = "workout_set"
    __table_args__ = (
        CheckConstraint("set_number >= 1", name="ck_workout_set_number"),
        CheckConstraint("repetitions IS NULL OR repetitions >= 0", name="ck_workout_set_reps"),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0", name="ck_workout_set_duration"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_session.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workout_exercise.id", ondelete="SET NULL")
    )
    set_number: Mapped[int] = mapped_column(Integer)
    repetitions: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean, default=True)

    session: Mapped[WorkoutSession] = relationship(back_populates="sets")
