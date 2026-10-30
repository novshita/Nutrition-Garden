"""Pure garden rules: growth stage and weight-goal progress (engineering spec §38-40)."""

from app.config import GROWTH_STAGE_THRESHOLDS, WEIGHT_PROGRESS_MILESTONES_PERCENT


def stage_for_points(points: int) -> int:
    """Highest stage whose threshold has been reached; always at least stage 1."""
    if points < 0:
        raise ValueError("points cannot be negative")
    return max(1, sum(1 for threshold in GROWTH_STAGE_THRESHOLDS if points >= threshold))


def next_stage_threshold(points: int) -> int | None:
    """Points needed for the next stage, or None at the final stage."""
    return next((t for t in GROWTH_STAGE_THRESHOLDS if t > points), None)


def weight_progress_percent(start_kg: float, current_kg: float, goal_kg: float) -> float | None:
    """How far from the first weight toward the goal weight. None if the goal isn't above start."""
    if goal_kg <= start_kg:
        return None
    return (current_kg - start_kg) / (goal_kg - start_kg) * 100


def weight_milestones_reached(percent: float | None) -> list[int]:
    if percent is None:
        return []
    return [m for m in WEIGHT_PROGRESS_MILESTONES_PERCENT if percent >= m]
