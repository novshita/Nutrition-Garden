from fastapi import APIRouter

from app.api.v1 import auth, bmi, goals, health, profile, weight

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(goals.router)
api_router.include_router(weight.router)
api_router.include_router(bmi.router)
