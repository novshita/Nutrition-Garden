"""The gentle evening reminder (engineering spec §48, product spec §38).

Decided entirely by the backend, with fixed kind wording, so it works even when AI is down. At most one
a day, and only when today has been light on food.
"""

from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.enums import NudgeKind
from app.models import FairyNudge, User
from app.schemas.ai import NudgeResponse
from app.services import goals
from app.services.nutrition import food_logging
from app.services.timezone import get_timezone, local_day_bounds

MESSAGE = "You still have some room left in today's nutrition garden. Want a few easy meal ideas?"


def check_nudge(db: Session, user: User, now: datetime) -> NudgeResponse:
    tz = get_timezone(db, user)
    local_now = now.astimezone(tz)
    if local_now.hour < config.NUDGE_AFTER_HOUR:
        return NudgeResponse(show=False)

    day = local_now.date()
    _, day_end = local_day_bounds(day, tz)
    target = goals.get_target_at(db, user, day_end)
    if target is None:
        return NudgeResponse(show=False)

    totals = food_logging.daily_totals(food_logging.list_logs_for_day(db, user, day))
    eaten = totals.calories or 0
    if eaten >= config.NUDGE_BELOW_RATIO * target.target_kcal:
        return NudgeResponse(show=False)

    try:
        with db.begin_nested():  # the unique key is the once-a-day cooldown
            db.add(FairyNudge(user_id=user.id, nudge_date=day, kind=NudgeKind.LOW_INTAKE))
    except IntegrityError:
        return NudgeResponse(show=False)
    return NudgeResponse(show=True, message=MESSAGE)
