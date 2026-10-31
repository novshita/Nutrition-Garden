"""A per-user daily cap on AI calls, so an open signup can't run up the OpenAI bill."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.models import AiUsage, User
from app.services.ai.client import AiLimitError
from app.services.timezone import local_today


def consume_ai_call(db: Session, user: User) -> None:
    """Count one AI call for today, or raise AiLimitError if the allowance is used up.

    Committed straight away so the count survives even if the call itself then fails.
    """
    day = local_today(db, user)
    query = select(AiUsage).where(AiUsage.user_id == user.id, AiUsage.usage_date == day)
    row = db.scalar(query)
    if row is None:
        try:
            with db.begin_nested():  # a concurrent request may create today's row first
                db.add(AiUsage(user_id=user.id, usage_date=day, calls=0))
        except IntegrityError:
            pass
        row = db.scalar(query)
    if row.calls >= config.AI_DAILY_CALL_LIMIT:
        raise AiLimitError("Daily AI limit reached")
    row.calls += 1
    db.commit()
