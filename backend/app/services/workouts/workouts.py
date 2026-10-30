"""Workout templates, the weekly schedule and recorded sessions (engineering spec §24–30)."""

import uuid
from datetime import UTC, date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import GrowthAction, Weekday
from app.models import (
    User,
    WorkoutExercise,
    WorkoutSchedule,
    WorkoutSession,
    WorkoutSet,
    WorkoutTemplate,
)
from app.schemas.workouts import (
    ScheduleDayOut,
    ScheduleUpdate,
    SessionCreate,
    SessionOut,
    TemplateCreate,
)
from app.services import weight as weight_service
from app.services.calculations.workouts import estimate_calories
from app.services.errors import NotFoundError
from app.services.garden import garden as garden_service
from app.services.timezone import get_timezone, local_date_of, local_day_bounds

WEEKDAYS = list(Weekday)  # Monday first


class InvalidSetError(ValueError):
    pass


# Templates -----------------------------------------------------------------------------


def create_template(db: Session, user: User, data: TemplateCreate) -> WorkoutTemplate:
    template = WorkoutTemplate(
        user_id=user.id,
        name=data.name.strip(),
        description=data.description,
        difficulty=data.difficulty,
        exercises=[
            WorkoutExercise(order_index=i, **e.model_dump(exclude_none=False))
            for i, e in enumerate(data.exercises)
        ],
    )
    db.add(template)
    db.flush()
    return template


def list_templates(db: Session, user: User) -> list[WorkoutTemplate]:
    return list(
        db.scalars(
            select(WorkoutTemplate)
            .where(WorkoutTemplate.user_id == user.id)
            .order_by(WorkoutTemplate.created_at.asc(), WorkoutTemplate.name.asc())
        )
    )


def _owned_template(db: Session, user: User, template_id: uuid.UUID) -> WorkoutTemplate:
    template = db.scalar(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user.id
        )
    )
    if template is None:
        raise NotFoundError
    return template


# Schedule ------------------------------------------------------------------------------


def replace_schedule(db: Session, user: User, data: ScheduleUpdate) -> list[ScheduleDayOut]:
    for day in data.days:
        if day.template_id is not None:
            _owned_template(db, user, day.template_id)  # NotFoundError if not the user's
    for row in db.scalars(select(WorkoutSchedule).where(WorkoutSchedule.user_id == user.id)):
        db.delete(row)
    db.flush()
    for day in data.days:
        db.add(
            WorkoutSchedule(
                user_id=user.id,
                weekday=day.weekday,
                template_id=day.template_id,
                is_rest_day=day.is_rest_day,
            )
        )
    db.flush()
    return get_schedule(db, user)


def get_schedule(db: Session, user: User) -> list[ScheduleDayOut]:
    rows = db.scalars(select(WorkoutSchedule).where(WorkoutSchedule.user_id == user.id))
    ordered = sorted(rows, key=lambda r: WEEKDAYS.index(r.weekday))
    return [
        ScheduleDayOut(
            weekday=r.weekday,
            is_rest_day=r.is_rest_day,
            template_id=r.template_id,
            template_name=r.template.name if r.template else None,
        )
        for r in ordered
    ]


def planned_workout_for(db: Session, user: User, day: date) -> ScheduleDayOut | None:
    """What is planned on a given local date, for the dashboard and the fairy (spec §37)."""
    weekday = WEEKDAYS[day.weekday()]
    return next((d for d in get_schedule(db, user) if d.weekday == weekday), None)


# Sessions ------------------------------------------------------------------------------


def create_session(db: Session, user: User, data: SessionCreate) -> WorkoutSession:
    template = _owned_template(db, user, data.template_id) if data.template_id else None

    exercise_ids = {s.exercise_id for s in data.sets}
    exercises: dict[uuid.UUID, WorkoutExercise] = {}
    if exercise_ids:
        rows = db.scalars(
            select(WorkoutExercise)
            .join(WorkoutTemplate, WorkoutExercise.template_id == WorkoutTemplate.id)
            .where(WorkoutExercise.id.in_(exercise_ids), WorkoutTemplate.user_id == user.id)
        )
        exercises = {e.id: e for e in rows}
    for exercise_id in exercise_ids:
        exercise = exercises.get(exercise_id)
        if exercise is None or (template is not None and exercise.template_id != template.id):
            raise InvalidSetError("A set refers to an exercise that isn't part of this workout")

    if exercises:
        categories = [e.category.value for e in exercises.values()]
    elif template is not None:
        categories = [e.category.value for e in template.exercises]
    else:
        categories = []

    duration = int((data.completed_at - data.started_at).total_seconds())
    latest_weight = weight_service.get_latest(db, user)
    session = WorkoutSession(
        user_id=user.id,
        template_id=template.id if template else None,
        started_at=data.started_at.astimezone(UTC),
        completed_at=data.completed_at.astimezone(UTC),
        duration_seconds=duration,
        estimated_calories=estimate_calories(
            categories, float(latest_weight.weight_kg) if latest_weight else None, duration
        ),
        notes=data.notes,
        sets=[
            WorkoutSet(
                exercise_id=s.exercise_id,
                set_number=s.set_number,
                repetitions=s.repetitions,
                duration_seconds=s.duration_seconds,
                completed=s.completed,
            )
            for s in data.sets
        ],
    )
    db.add(session)
    db.flush()
    garden_service.record(
        db, user, GrowthAction.WORKOUT_COMPLETED, local_date_of(db, user, session.started_at)
    )
    return session


def list_sessions(
    db: Session, user: User, start_date: date | None, end_date: date | None, limit: int
) -> list[WorkoutSession]:
    tz = get_timezone(db, user)
    query = select(WorkoutSession).where(WorkoutSession.user_id == user.id)
    if start_date is not None:
        query = query.where(WorkoutSession.started_at >= local_day_bounds(start_date, tz)[0])
    if end_date is not None:
        query = query.where(WorkoutSession.started_at < local_day_bounds(end_date, tz)[1])
    return list(db.scalars(query.order_by(WorkoutSession.started_at.desc()).limit(limit)))


def session_out(session: WorkoutSession) -> SessionOut:
    out = SessionOut.model_validate(session)
    out.template_name = session.template.name if session.template else None
    out.sets.sort(key=lambda s: s.set_number)  # a just-created session isn't reloaded in order
    return out
