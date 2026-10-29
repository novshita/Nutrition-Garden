"""Workout calorie estimate (informational only; never touches the food target, spec §23, §30)."""

from collections.abc import Iterable

from app.config import WORKOUT_MET_BY_CATEGORY


def estimate_calories(
    categories: Iterable[str], weight_kg: float | None, duration_seconds: int
) -> int | None:
    """kcal = average MET of the exercises done x body weight (kg) x hours.

    Returns None when it can't be estimated (no exercises known or no weight), never 0.
    """
    mets = [WORKOUT_MET_BY_CATEGORY[c] for c in categories]
    if not mets or weight_kg is None or weight_kg <= 0 or duration_seconds <= 0:
        return None
    met = sum(mets) / len(mets)
    return round(met * weight_kg * duration_seconds / 3600)
