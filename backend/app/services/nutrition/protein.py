"""The week's protein, from the foods the person logged."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.config import PROTEIN_SUMMARY_DAYS
from app.models import User
from app.schemas.protein import ProteinWeek
from app.services import weight as weight_service
from app.services.calculations.protein import summarize_week
from app.services.nutrition import food_logging


def week_summary(db: Session, user: User, end: date) -> ProteinWeek:
    days = [end - timedelta(days=offset) for offset in range(PROTEIN_SUMMARY_DAYS - 1, -1, -1)]
    totals = [food_logging.daily_totals(food_logging.list_logs_for_day(db, user, d)) for d in days]
    latest = weight_service.get_latest(db, user)
    return summarize_week(end, totals, float(latest.weight_kg) if latest else None)
