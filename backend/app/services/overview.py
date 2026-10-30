"""The day-at-a-glance view: dashboard, daily summary and calendar day detail (spec §49, §57).

Everything here is read from the existing trackers; nothing is copied or stored again.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.dashboard import (
    CaloriesOverview,
    CompletedWorkout,
    DayOverview,
    GardenOverview,
    PlannedWorkout,
    ProteinOverview,
    WorkoutOverview,
)
from app.services import daily, goals
from app.services import weight as weight_service
from app.services.garden import garden as garden_service
from app.services.nutrition import food_logging
from app.services.timezone import get_timezone, local_day_bounds
from app.services.workouts import workouts as workout_service


def build_overview(db: Session, user: User, day: date) -> DayOverview:
    tz = get_timezone(db, user)

    totals = food_logging.daily_totals(food_logging.list_logs_for_day(db, user, day))
    _, day_end = local_day_bounds(day, tz)
    target = goals.get_target_at(db, user, day_end)
    target_kcal = target.target_kcal if target else None
    if target_kcal is None:
        remaining = None
    else:
        remaining = round(max(target_kcal - (totals.calories or 0), 0), 2)

    sleep = daily.get_sleep(db, user, day)
    steps = daily.get_steps(db, user, day)
    mood = daily.get_mood(db, user, day)
    weights = weight_service.list_weights(db, user, day, day, 1000)

    planned = workout_service.planned_workout_for(db, user, day)
    sessions = [
        workout_service.session_out(s)
        for s in workout_service.list_sessions(db, user, day, day, 100)
    ]

    garden = garden_service.get_garden(db, user)
    points, actions = garden_service.get_day_growth(db, user, day)

    return DayOverview(
        date=day,
        calories=CaloriesOverview(consumed=totals.calories, target=target_kcal, remaining=remaining),
        protein=ProteinOverview(consumed_g=totals.protein_g),
        nutrition=food_logging.totals_out(totals),
        water_ml=daily.get_water_day(db, user, day).total_ml,
        sleep_minutes=sleep.duration_minutes if sleep else None,
        steps=steps.steps if steps else None,
        mood=mood.mood if mood else None,
        weight_kg=float(weights[-1].weight_kg) if weights else None,
        workout=WorkoutOverview(
            planned=PlannedWorkout(**planned.model_dump()) if planned else None,
            completed=[
                CompletedWorkout(
                    id=s.id,
                    template_name=s.template_name,
                    duration_seconds=s.duration_seconds,
                    estimated_calories=s.estimated_calories,
                )
                for s in sessions
            ],
        ),
        garden=GardenOverview(
            growth_points=garden.growth_points,
            growth_stage=garden.growth_stage,
            bunny_stage=garden.bunny_stage,
            points_earned=points,
            actions=actions,
        ),
    )
