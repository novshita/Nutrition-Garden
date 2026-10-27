from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.enums import TrendState
from app.services.calculations.weight_trend import (
    compute_trend,
    daily_means,
    rolling_average_series,
)

TODAY = date(2026, 10, 20)


def days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def test_single_measurement_gives_no_trend():
    result = compute_trend({TODAY: 50.0}, TODAY)
    assert result.state == TrendState.INSUFFICIENT_DATA
    assert result.weekly_change_kg is None


def test_no_data_is_insufficient():
    assert compute_trend({}, TODAY).state == TrendState.INSUFFICIENT_DATA


def test_data_in_only_one_window_is_insufficient():
    daily = {days_ago(i): 50.0 for i in range(5)}
    assert compute_trend(daily, TODAY).state == TrendState.INSUFFICIENT_DATA


def test_two_days_total_is_insufficient_even_with_both_windows():
    daily = {TODAY: 50.0, days_ago(8): 50.0}
    assert compute_trend(daily, TODAY).state == TrendState.INSUFFICIENT_DATA


def weights(current: float, previous: float) -> dict[date, float]:
    daily = {days_ago(i): current for i in range(7)}
    daily.update({days_ago(i): previous for i in range(7, 14)})
    return daily


@pytest.mark.parametrize(
    "current,previous,state",
    [
        (50.05, 50.0, TrendState.STABLE),
        (49.95, 50.0, TrendState.STABLE),
        (50.3, 50.0, TrendState.INCREASING),
        (50.6, 50.0, TrendState.INCREASING_FAST),
        (49.7, 50.0, TrendState.DECREASING),
        (49.4, 50.0, TrendState.DECREASING_FAST),
    ],
)
def test_trend_states(current, previous, state):
    result = compute_trend(weights(current, previous), TODAY)
    assert result.state == state
    assert result.weekly_change_kg == pytest.approx(current - previous)


def test_stale_data_is_not_a_current_trend():
    daily = {days_ago(i): 50.0 for i in range(30, 40)}
    assert compute_trend(daily, TODAY).state == TrendState.INSUFFICIENT_DATA


def test_daily_means_group_by_local_day():
    tz = ZoneInfo("Asia/Kolkata")  # UTC+5:30
    entries = [
        (datetime(2026, 10, 19, 20, 0, tzinfo=UTC), 50.0),  # 01:30 on the 20th local
        (datetime(2026, 10, 20, 3, 0, tzinfo=UTC), 52.0),  # 08:30 on the 20th local
        (datetime(2026, 10, 20, 20, 0, tzinfo=UTC), 60.0),  # 01:30 on the 21st local
    ]
    daily = daily_means(entries, tz)
    assert daily == {date(2026, 10, 20): 51.0, date(2026, 10, 21): 60.0}


def test_rolling_average_uses_trailing_seven_days():
    daily = {days_ago(8): 40.0, days_ago(1): 50.0, TODAY: 52.0}
    series = dict(rolling_average_series(daily))
    assert series[days_ago(8)] == 40.0
    assert series[days_ago(1)] == 50.0  # day -8 is outside the 7-day window
    assert series[TODAY] == pytest.approx(51.0)
