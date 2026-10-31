from datetime import date, timedelta

import pytest

from app.config import MAX_CALORIE_TARGET_KCAL
from app.enums import SuggestionReason, SuggestionStatus, TrendState
from app.services.calculations.adaptive import evaluate, suggest

TODAY = date(2026, 10, 30)


def daily(start_offset: int, slope_per_day: float = 0.0, base: float = 50.0, every: int = 1):
    """Weights from `start_offset` days ago to today, rising by slope_per_day."""
    data = {}
    for i in range(start_offset, -1, -every):
        data[TODAY - timedelta(days=i)] = base + slope_per_day * (start_offset - i)
    return data


LONG_AGO = TODAY - timedelta(days=100)


def test_period_shorter_than_three_weeks_is_insufficient_with_countdown():
    result = evaluate(daily(27), TODAY, TODAY - timedelta(days=10))
    assert result.trend_state == TrendState.INSUFFICIENT_DATA
    assert result.weekly_change_kg is None
    assert result.days_until_ready == 21 - 11  # 11 days since the change


def test_a_recent_target_change_resets_the_evaluation_even_with_long_history():
    result = evaluate(daily(60), TODAY, TODAY - timedelta(days=3))
    assert result.trend_state == TrendState.INSUFFICIENT_DATA
    assert result.period_start == TODAY - timedelta(days=3)


def test_no_weights_is_insufficient():
    assert evaluate({}, TODAY, LONG_AGO).trend_state == TrendState.INSUFFICIENT_DATA


def test_too_few_weigh_ins_at_either_end_is_insufficient():
    only_recent = {TODAY - timedelta(days=i): 50.0 for i in range(7)}
    assert evaluate(only_recent, TODAY, LONG_AGO).trend_state == TrendState.INSUFFICIENT_DATA
    sparse = {TODAY - timedelta(days=27): 50.0, TODAY - timedelta(days=1): 50.0, TODAY: 50.0}
    assert evaluate(sparse, TODAY, LONG_AGO).trend_state == TrendState.INSUFFICIENT_DATA


def test_single_measurement_never_gives_a_trend():
    assert evaluate({TODAY: 50.0}, TODAY, LONG_AGO).trend_state == TrendState.INSUFFICIENT_DATA


def test_stable_weight_over_four_weeks_suggests_plus_100():
    result = evaluate(daily(27, 0.0), TODAY, LONG_AGO)
    assert result.trend_state == TrendState.STABLE
    assert result.weekly_change_kg == pytest.approx(0.0, abs=1e-9)
    assert result.days_until_ready is None
    s = suggest(result, 2500)
    assert (s.status, s.reason, s.suggested_target_kcal) == (
        SuggestionStatus.REVIEW_SUGGESTED,
        SuggestionReason.STABLE_WEIGHT,
        2600,
    )


def test_exactly_three_weeks_since_the_change_is_enough():
    result = evaluate(daily(20, 0.0), TODAY, TODAY - timedelta(days=20))
    assert result.trend_state == TrendState.STABLE
    just_short = evaluate(daily(19, 0.0), TODAY, TODAY - timedelta(days=19))
    assert just_short.trend_state == TrendState.INSUFFICIENT_DATA
    assert just_short.days_until_ready == 1


def test_weekly_change_is_measured_between_first_and_last_week():
    # +0.6 kg per week => 0.6 / 7 per day, regardless of period length
    for days in (20, 27):
        result = evaluate(daily(days, 0.6 / 7), TODAY, TODAY - timedelta(days=days))
        assert result.weekly_change_kg == pytest.approx(0.6, abs=1e-6)
        assert result.trend_state == TrendState.INCREASING_FAST


def test_gaining_too_fast_recommends_a_review_without_a_number():
    result = evaluate(daily(27, 0.6 / 7), TODAY, LONG_AGO)
    s = suggest(result, 2500)
    assert s.status == SuggestionStatus.REVIEW_SUGGESTED
    assert s.reason == SuggestionReason.WEIGHT_RISING_FAST
    assert s.suggested_target_kcal is None


def test_steady_gain_needs_no_change():
    result = evaluate(daily(27, 0.3 / 7), TODAY, LONG_AGO)
    assert result.trend_state == TrendState.INCREASING
    s = suggest(result, 2500)
    assert (s.status, s.suggested_target_kcal) == (SuggestionStatus.NO_CHANGE_SUGGESTED, None)


@pytest.mark.parametrize("slope", [-0.3 / 7, -0.7 / 7])
def test_losing_weight_makes_no_automatic_suggestion(slope):
    result = evaluate(daily(27, slope), TODAY, LONG_AGO)
    assert result.trend_state in (TrendState.DECREASING, TrendState.DECREASING_FAST)
    assert suggest(result, 2500).status == SuggestionStatus.NO_CHANGE_SUGGESTED


def test_suggestion_never_exceeds_the_maximum_target():
    result = evaluate(daily(27, 0.0), TODAY, LONG_AGO)
    s = suggest(result, MAX_CALORIE_TARGET_KCAL - 50)
    assert (s.status, s.suggested_target_kcal) == (SuggestionStatus.NO_CHANGE_SUGGESTED, None)


def test_insufficient_data_makes_no_recommendation():
    """Mandatory business-logic test #7 at the rule level."""
    result = evaluate(daily(5, 0.0), TODAY, LONG_AGO)
    s = suggest(result, 2500)
    assert (s.status, s.reason, s.suggested_target_kcal) == (
        SuggestionStatus.INSUFFICIENT_DATA,
        None,
        None,
    )


def test_data_outside_the_period_is_ignored():
    old_gain = {TODAY - timedelta(days=60 + i): 40.0 + i for i in range(10)}
    stable = daily(27, 0.0)
    assert evaluate({**old_gain, **stable}, TODAY, LONG_AGO).trend_state == TrendState.STABLE
