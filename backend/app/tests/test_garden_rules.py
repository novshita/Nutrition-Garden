import pytest

from app.services.calculations.garden import (
    next_stage_threshold,
    stage_for_points,
    weight_milestones_reached,
    weight_progress_percent,
)


@pytest.mark.parametrize(
    "points,stage",
    [(0, 1), (1, 1), (49, 1), (50, 2), (149, 2), (150, 3), (299, 3), (300, 4), (499, 4), (500, 5), (9999, 5)],
)
def test_bunny_and_garden_stage_thresholds(points, stage):
    assert stage_for_points(points) == stage


def test_negative_points_are_invalid():
    with pytest.raises(ValueError):
        stage_for_points(-1)


@pytest.mark.parametrize("points,expected", [(0, 50), (49, 50), (50, 150), (499, 500), (500, None)])
def test_next_stage_threshold(points, expected):
    assert next_stage_threshold(points) == expected


def test_stage_never_decreases_as_points_grow():
    stages = [stage_for_points(p) for p in range(700)]
    assert stages == sorted(stages)


def test_weight_progress_percent():
    assert weight_progress_percent(50, 55, 60) == 50
    assert weight_progress_percent(50, 48, 60) == -20  # dipping is fine; it just isn't progress
    assert weight_progress_percent(60, 55, 60) is None  # goal not above the starting weight
    assert weight_progress_percent(60, 61, 55) is None


def test_weight_milestones_reached():
    assert weight_milestones_reached(None) == []
    assert weight_milestones_reached(-5) == []
    assert weight_milestones_reached(24.9) == []
    assert weight_milestones_reached(50) == [25, 50]
    assert weight_milestones_reached(130) == [25, 50, 75, 100]
