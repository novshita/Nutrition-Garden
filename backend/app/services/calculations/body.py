"""BMI, BMR, TDEE and initial calorie target (spec §8–12).

These are the authoritative calculations; AI must never compute them.
"""

from datetime import date

from app.config import ACTIVITY_MULTIPLIERS, INITIAL_SURPLUS_KCAL
from app.enums import ActivityLevel, Sex


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")


def age_in_years(date_of_birth: date, today: date) -> int:
    if date_of_birth > today:
        raise ValueError("date_of_birth cannot be in the future")
    had_birthday = (today.month, today.day) >= (date_of_birth.month, date_of_birth.day)
    return today.year - date_of_birth.year - (0 if had_birthday else 1)


def bmi(weight_kg: float, height_cm: float) -> float:
    """BMI = weight_kg / height_m². Informational only."""
    _require_positive("weight_kg", weight_kg)
    _require_positive("height_cm", height_cm)
    height_m = height_cm / 100
    return weight_kg / (height_m**2)


def bmr(weight_kg: float, height_cm: float, age: int, sex: Sex) -> float:
    """Mifflin-St Jeor equation."""
    _require_positive("weight_kg", weight_kg)
    _require_positive("height_cm", height_cm)
    if age < 0:
        raise ValueError("age cannot be negative")
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if sex == Sex.MALE else base - 161


def tdee(bmr_kcal: float, activity_level: ActivityLevel) -> float:
    _require_positive("bmr_kcal", bmr_kcal)
    return bmr_kcal * ACTIVITY_MULTIPLIERS[activity_level]


def initial_calorie_target(tdee_kcal: float) -> int:
    """TDEE + 250 kcal/day, rounded to a whole kcal. An estimate, not medical advice."""
    _require_positive("tdee_kcal", tdee_kcal)
    return round(tdee_kcal + INITIAL_SURPLUS_KCAL)
