from fastapi import APIRouter

from app.api.v1 import (
    activity,
    auth,
    bmi,
    food,
    food_log,
    garden,
    goals,
    health,
    mood,
    nutrition,
    profile,
    sleep,
    water,
    weight,
    workouts,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(goals.router)
api_router.include_router(weight.router)
api_router.include_router(bmi.router)
api_router.include_router(water.router)
api_router.include_router(sleep.router)
api_router.include_router(mood.router)
api_router.include_router(activity.router)
api_router.include_router(food_log.router)
api_router.include_router(food.router)
api_router.include_router(nutrition.router)
api_router.include_router(workouts.router)
api_router.include_router(garden.router)
