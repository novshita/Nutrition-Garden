import getpass
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from alembic import command

# Tests must never touch the development database or need real keys.
# Override TEST_DATABASE_URL to point at a different throwaway database.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    f"postgresql+psycopg://{getpass.getuser()}@localhost:5432/nutrition_garden_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("OPENAI_API_KEY", "test")
os.environ.setdefault("USDA_API_KEY", "test")
os.environ.setdefault("AUTH_SECRET", "test")
os.environ["APP_ENV"] = "test"

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def engine():
    """Test database built by running the real Alembic migrations."""
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(alembic_cfg, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine) -> Iterator[Session]:
    """Session whose work is rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    """API client whose requests share the rolled-back test session."""
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def usda(client):
    """Fake USDA client injected into the API (no network)."""
    from app.main import app
    from app.services.nutrition.usda_client import get_usda_client
    from app.tests.fakes import FakeUsda

    fake = FakeUsda()
    app.dependency_overrides[get_usda_client] = lambda: fake
    return fake


@pytest.fixture
def ai(client):
    """Fake AI client injected into the API (no network, no OpenAI)."""
    from app.main import app
    from app.services.ai.client import get_ai_client
    from app.tests.fakes import FakeAi

    fake = FakeAi()
    app.dependency_overrides[get_ai_client] = lambda: fake
    return fake
