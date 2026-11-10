from datetime import UTC, datetime, timedelta

import pytest

from app.config import PROTEIN_GUIDE_G_PER_KG
from app.services.calculations.nutrition import compute_totals
from app.services.calculations.protein import protein_guide, summarize_week
from app.tests.test_dashboard import onboard, signup

WEEK = "/api/v1/nutrition/protein/week"
TODAY = datetime.now(UTC).date()


def eat(client, days_ago, protein, calories=300, name="Meal"):
    # Midday on past days; "just now" for today, so the test works at any time of day.
    now = datetime.now(UTC) - timedelta(seconds=30)
    at = now if days_ago == 0 else (now - timedelta(days=days_ago)).replace(hour=12, minute=0)
    item = {
        "food_source": "CUSTOM",
        "food_name": name,
        "quantity": 1,
        "unit": "plate",
        "calories": calories,
    }
    if protein is not None:
        item["protein_g"] = protein
    r = client.post(
        "/api/v1/food/log",
        json={"meal_type": "LUNCH", "consumed_at": at.isoformat(), "items": [item]},
    )
    assert r.status_code == 201, r.text


# ---- The gentle reminder ----


def test_guide_for_a_forty_kilo_person():
    guide = protein_guide(40)
    assert (guide.low_g_per_day, guide.high_g_per_day) == (48, 64)
    assert (guide.low_g_per_week, guide.high_g_per_week) == (336, 448)
    assert guide.weight_kg == 40


def test_guide_scales_with_weight_and_uses_the_configured_range():
    low, high = PROTEIN_GUIDE_G_PER_KG
    for kg in (45, 52.5, 70, 100):
        guide = protein_guide(kg)
        assert guide.low_g_per_day == round(kg * low)
        assert guide.high_g_per_day == round(kg * high)
        assert guide.low_g_per_day < guide.high_g_per_day


@pytest.mark.parametrize("weight", [None, 0, -5])
def test_no_guide_without_a_usable_weight(weight):
    assert protein_guide(weight) is None


# ---- The week's summary ----


def totals(*protein_values):
    class Item:
        def __init__(self, protein):
            self.calories = 100
            self.protein_g = protein
            self.carbohydrate_g = self.fat_g = self.fiber_g = None

    return compute_totals(Item(p) for p in protein_values)


def test_summary_counts_the_week_and_averages_only_days_with_data():
    days = [totals(20), totals(), totals(30, 10), totals(), totals(), totals(), totals(60)]
    week = summarize_week(TODAY, days, 50)
    assert week.total_g == 120
    assert week.days_with_protein == 3
    assert week.average_g_per_day == 40  # not 120/7: days with nothing logged aren't zeros
    assert [d.protein_g for d in week.days] == [20, None, 40, None, None, None, 60]
    assert week.start_date == TODAY - timedelta(days=6) and week.end_date == TODAY


def test_a_week_with_nothing_logged_is_unknown_not_zero():
    week = summarize_week(TODAY, [totals() for _ in range(7)], 50)
    assert week.total_g is None
    assert week.average_g_per_day is None
    assert week.days_with_protein == 0
    assert all(d.protein_g is None for d in week.days)


def test_foods_without_protein_data_are_counted_so_the_total_reads_as_at_least():
    week = summarize_week(TODAY, [totals(20, None, None)] + [totals() for _ in range(6)], 50)
    assert week.total_g == 20
    assert week.foods_missing_protein == 2
    assert week.days[0].foods_missing_protein == 2


def test_week_endpoint_sums_what_was_logged(client):
    signup(client)
    onboard(client, weight=52)
    eat(client, 0, 25)
    eat(client, 0, 15, name="Snack")
    eat(client, 2, 40)
    eat(client, 5, 30)
    eat(client, 9, 99)  # outside the 7 days
    body = client.get(WEEK).json()
    assert body["end_date"] == TODAY.isoformat()
    assert len(body["days"]) == 7
    assert body["total_g"] == 110
    assert body["days_with_protein"] == 3
    assert body["average_g_per_day"] == pytest.approx(36.7, abs=0.05)
    assert body["days"][-1]["protein_g"] == 40
    assert body["guide"] == {
        "weight_kg": 52.0,
        "low_g_per_day": 62,
        "high_g_per_day": 83,
        "low_g_per_week": 434,
        "high_g_per_week": 581,
    }


def test_week_can_end_on_another_day(client):
    signup(client)
    onboard(client)
    eat(client, 10, 35)
    end = (TODAY - timedelta(days=8)).isoformat()
    body = client.get(WEEK, params={"end": end}).json()
    assert body["end_date"] == end
    assert body["total_g"] == 35


def test_empty_week_has_no_total_but_still_has_the_guide(client):
    signup(client)
    onboard(client, weight=40)
    body = client.get(WEEK).json()
    assert body["total_g"] is None and body["average_g_per_day"] is None
    assert (body["guide"]["low_g_per_day"], body["guide"]["high_g_per_day"]) == (48, 64)


def test_there_is_no_target_anywhere(client):
    signup(client)
    onboard(client)
    today = client.get("/api/v1/dashboard/today").json()
    assert "target_g" not in today["protein"]
    assert set(client.get(WEEK).json()["guide"]) >= {"low_g_per_day", "high_g_per_day"}
    assert "target" not in str(client.get(WEEK).json()).lower()


def test_dashboard_carries_the_guide_for_current_weight(client):
    signup(client)
    onboard(client, weight=40)
    protein = client.get("/api/v1/dashboard/today").json()["protein"]
    assert (protein["guide"]["low_g_per_day"], protein["guide"]["high_g_per_day"]) == (48, 64)
    client.post("/api/v1/weight", json={"weight_kg": 50})
    protein = client.get("/api/v1/dashboard/today").json()["protein"]
    assert (protein["guide"]["low_g_per_day"], protein["guide"]["high_g_per_day"]) == (60, 80)


def test_falling_short_changes_nothing(client):
    """No punishment mechanics: a low protein week doesn't touch the garden or the calorie goal."""
    signup(client)
    onboard(client)
    eat(client, 0, 5)
    before = client.get("/api/v1/garden").json()["growth_points"]
    client.get(WEEK)
    assert client.get("/api/v1/garden").json()["growth_points"] == before


def test_the_week_is_private(client):
    signup(client, "a@example.com")
    onboard(client)
    eat(client, 0, 80)
    signup(client, "b@example.com")
    onboard(client)
    assert client.get(WEEK).json()["total_g"] is None


def test_week_requires_sign_in(client):
    assert client.get(WEEK).status_code == 401
