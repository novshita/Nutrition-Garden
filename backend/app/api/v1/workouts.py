import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.workouts import (
    ScheduleDayOut,
    ScheduleUpdate,
    SessionCreate,
    SessionOut,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)
from app.services.errors import NotFoundError
from app.services.workouts import workouts as service

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(body: TemplateCreate, user: CurrentUser, db: DbSession) -> TemplateOut:
    template = service.create_template(db, user, body)
    out = TemplateOut.model_validate(template)
    db.commit()
    return out


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(user: CurrentUser, db: DbSession) -> list[TemplateOut]:
    return service.list_templates(db, user)


@router.put("/templates/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: uuid.UUID, body: TemplateUpdate, user: CurrentUser, db: DbSession
) -> TemplateOut:
    try:
        template = service.update_template(db, user, template_id, body)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout template not found") from None
    except service.InvalidExerciseError as exc:
        raise HTTPException(422, str(exc)) from None
    out = TemplateOut.model_validate(template)
    db.commit()
    return out


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    try:
        service.delete_template(db, user, template_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout template not found") from None
    db.commit()


@router.get("/schedule", response_model=list[ScheduleDayOut])
def get_schedule(user: CurrentUser, db: DbSession) -> list[ScheduleDayOut]:
    return service.get_schedule(db, user)


@router.put("/schedule", response_model=list[ScheduleDayOut])
def update_schedule(body: ScheduleUpdate, user: CurrentUser, db: DbSession) -> list[ScheduleDayOut]:
    """Replace the whole weekly plan. Weekdays left out have nothing planned."""
    try:
        schedule = service.replace_schedule(db, user, body)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout template not found") from None
    db.commit()
    return schedule


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, user: CurrentUser, db: DbSession) -> SessionOut:
    try:
        session = service.create_session(db, user, body)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout template not found") from None
    except service.InvalidSetError as exc:
        raise HTTPException(422, str(exc)) from None
    out = service.session_out(session)
    db.commit()
    return out


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    user: CurrentUser,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[SessionOut]:
    sessions = service.list_sessions(db, user, start_date, end_date, limit)
    return [service.session_out(s) for s in sessions]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    try:
        service.delete_session(db, user, session_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found") from None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
