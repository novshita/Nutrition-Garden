"""Adaptive calorie review (engineering spec §14). Pure rules; nothing here changes a target.

Looks at the weight trend since the last target change (at most about 4 weeks, at least 3). If
there isn't enough data it says so and makes no recommendation.
"""

from dataclasses import dataclass
from datetime import date, timedelta

from app.config import (
    ADAPTIVE_INCREASE_KCAL,
    ADAPTIVE_MIN_DAYS,
    ADAPTIVE_MIN_WEIGH_INS_PER_END_WINDOW,
    ADAPTIVE_WINDOW_DAYS,
    MAX_CALORIE_TARGET_KCAL,
    TREND_WINDOW_DAYS,
)
from app.enums import SuggestionReason, SuggestionStatus, TrendState
from app.services.calculations.weight_trend import classify_change


@dataclass(frozen=True)
class Evaluation:
    trend_state: TrendState
    weekly_change_kg: float | None
    period_start: date
    period_end: date
    weigh_in_days: int
    days_until_ready: int | None  # set when the only thing missing is time since the last change


@dataclass(frozen=True)
class Suggestion:
    status: SuggestionStatus
    reason: SuggestionReason | None
    suggested_target_kcal: int | None


def _window_average(daily: dict[date, float], start: date, end: date) -> tuple[float | None, int]:
    values = [daily[d] for d in (start + timedelta(days=i) for i in range((end - start).days + 1)) if d in daily]
    return (sum(values) / len(values), len(values)) if values else (None, 0)


def evaluate(daily: dict[date, float], today: date, target_effective: date) -> Evaluation:
    """Weekly weight change between the first and last week of the evaluation period."""
    start = max(target_effective, today - timedelta(days=ADAPTIVE_WINDOW_DAYS - 1))
    period_days = (today - start).days + 1
    in_period = {d: kg for d, kg in daily.items() if start <= d <= today}

    def insufficient(days_until_ready: int | None = None) -> Evaluation:
        return Evaluation(
            TrendState.INSUFFICIENT_DATA, None, start, today, len(in_period), days_until_ready
        )

    if period_days < ADAPTIVE_MIN_DAYS:
        return insufficient(ADAPTIVE_MIN_DAYS - period_days)

    end_of_first = start + timedelta(days=TREND_WINDOW_DAYS - 1)
    start_of_last = today - timedelta(days=TREND_WINDOW_DAYS - 1)
    first_avg, first_n = _window_average(in_period, start, end_of_first)
    last_avg, last_n = _window_average(in_period, start_of_last, today)
    if (
        first_avg is None
        or last_avg is None
        or first_n < ADAPTIVE_MIN_WEIGH_INS_PER_END_WINDOW
        or last_n < ADAPTIVE_MIN_WEIGH_INS_PER_END_WINDOW
    ):
        return insufficient()

    # The two windows are centred (period_days - 7) days apart.
    weeks_apart = (period_days - TREND_WINDOW_DAYS) / 7
    weekly_change = (last_avg - first_avg) / weeks_apart
    return Evaluation(classify_change(weekly_change), weekly_change, start, today, len(in_period), None)


def suggest(evaluation: Evaluation, current_target_kcal: int) -> Suggestion:
    state = evaluation.trend_state
    if state == TrendState.INSUFFICIENT_DATA:
        return Suggestion(SuggestionStatus.INSUFFICIENT_DATA, None, None)
    if state == TrendState.STABLE:
        raised = current_target_kcal + ADAPTIVE_INCREASE_KCAL
        if raised > MAX_CALORIE_TARGET_KCAL:
            return Suggestion(SuggestionStatus.NO_CHANGE_SUGGESTED, None, None)
        return Suggestion(SuggestionStatus.REVIEW_SUGGESTED, SuggestionReason.STABLE_WEIGHT, raised)
    if state == TrendState.INCREASING_FAST:
        # The spec says to recommend a review but gives no number, so none is suggested.
        return Suggestion(SuggestionStatus.REVIEW_SUGGESTED, SuggestionReason.WEIGHT_RISING_FAST, None)
    # Gaining at a steady pace, or losing (the spec defines no response to losing): do nothing.
    return Suggestion(SuggestionStatus.NO_CHANGE_SUGGESTED, None, None)
