from datetime import date

import pytest

from app.config import ActivityLevel
from app.services.calculations.body import (
    Sex,
    age_in_years,
    bmi,
    bmr,
    initial_calorie_target,
    tdee,
)


def test_bmi():
    assert bmi(70, 175) == pytest.approx(22.857, abs=1e-3)


@pytest.mark.parametrize("weight,height", [(0, 170), (-1, 170), (60, 0), (60, -5)])
def test_bmi_rejects_non_positive(weight, height):
    with pytest.raises(ValueError):
        bmi(weight, height)


def test_bmr_male():
    # 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
    assert bmr(70, 175, 30, Sex.MALE) == pytest.approx(1648.75)


def test_bmr_female():
    # 10*55 + 6.25*165 - 5*25 - 161 = 1295.25
    assert bmr(55, 165, 25, Sex.FEMALE) == pytest.approx(1295.25)


def test_bmr_rejects_invalid_input():
    with pytest.raises(ValueError):
        bmr(0, 170, 30, Sex.MALE)
    with pytest.raises(ValueError):
        bmr(60, 170, -1, Sex.MALE)


def test_tdee_uses_activity_multiplier():
    assert tdee(1600, ActivityLevel.SEDENTARY) == pytest.approx(1920)
    assert tdee(1600, ActivityLevel.MODERATE) == pytest.approx(2480)


def test_initial_target_is_tdee_plus_250():
    assert initial_calorie_target(2480) == 2730


def test_age_in_years_handles_birthday():
    dob = date(2000, 6, 15)
    assert age_in_years(dob, date(2026, 6, 14)) == 25
    assert age_in_years(dob, date(2026, 6, 15)) == 26


def test_age_rejects_future_dob():
    with pytest.raises(ValueError):
        age_in_years(date(2030, 1, 1), date(2026, 1, 1))
