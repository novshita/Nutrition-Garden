from enum import Enum
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class ActivityLevel(str, Enum):
    SEDENTARY = "SEDENTARY"
    LIGHT = "LIGHT"
    MODERATE = "MODERATE"
    VERY_ACTIVE = "VERY_ACTIVE"
    EXTRA_ACTIVE = "EXTRA_ACTIVE"


# Engineering spec §10: centralized, configurable activity multipliers.
ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.20,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.VERY_ACTIVE: 1.725,
    ActivityLevel.EXTRA_ACTIVE: 1.90,
}


# Engineering spec §12: initial default target is TDEE + 250 kcal/day.
INITIAL_SURPLUS_KCAL = 250


class Settings(BaseSettings):
    """Environment settings (engineering spec §53). Secrets never live in code."""

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    # Required
    openai_api_key: str
    usda_api_key: str
    database_url: str
    auth_secret: str
    app_env: str

    # Optional
    ai_model: str | None = None
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
