"""Weight trend from a 7-day rolling average (engineering spec §15).

Pure functions: no database, no AI. A trend is never derived from a single measurement.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import (
    TREND_FAST_THRESHOLD_KG_PER_WEEK,
    TREND_MIN_DAYS_WITH_DATA,
    TREND_STABLE_THRESHOLD_KG_PER_WEEK,
    TREND_WINDOW_DAYS,
)
from app.enums import TrendState


@dataclass(frozen=True)
class TrendResult:
    state: TrendState
    current_average_kg: float | None
    previous_average_kg: float | None
    weekly_change_kg: float | None
    days_with_data: int


def daily_means(entries: list[tuple[datetime, float]], tz: ZoneInfo) -> dict[date, float]:
    """Mean weight per local calendar day, so several weigh-ins in a day count once."""
    by_day: dict[date, list[float]] = {}
    for recorded_at, kg in entries:
        by_day.setdefault(recorded_at.astimezone(tz).date(), []).append(kg)
    return {day: sum(values) / len(values) for day, values in by_day.items()}


def _window_average(daily: dict[date, float], end: date) -> tuple[float | None, int]:
    days = [end - timedelta(days=i) for i in range(TREND_WINDOW_DAYS)]
    values = [daily[d] for d in days if d in daily]
    if not values:
        return None, 0
    return sum(values) / len(values), len(values)


def rolling_average_series(daily: dict[date, float]) -> list[tuple[date, float]]:
    """7-day rolling average ending on each day that has a weigh-in."""
    series = []
    for day in sorted(daily):
        average, _ = _window_average(daily, day)
        series.append((day, average))
    return series


def compute_trend(daily: dict[date, float], today: date) -> TrendResult:
    """Compare the 7 days ending today with the 7 days before that."""
    current, current_days = _window_average(daily, today)
    previous, previous_days = _window_average(daily, today - timedelta(days=TREND_WINDOW_DAYS))
    days_with_data = current_days + previous_days

    if current is None or previous is None or days_with_data < TREND_MIN_DAYS_WITH_DATA:
        return TrendResult(TrendState.INSUFFICIENT_DATA, current, previous, None, days_with_data)

    change = current - previous
    magnitude = abs(change)
    if magnitude < TREND_STABLE_THRESHOLD_KG_PER_WEEK:
        state = TrendState.STABLE
    elif change > 0:
        fast = magnitude >= TREND_FAST_THRESHOLD_KG_PER_WEEK
        state = TrendState.INCREASING_FAST if fast else TrendState.INCREASING
    else:
        fast = magnitude >= TREND_FAST_THRESHOLD_KG_PER_WEEK
        state = TrendState.DECREASING_FAST if fast else TrendState.DECREASING
    return TrendResult(state, current, previous, change, days_with_data)
