import os

# Settings require these; tests must not depend on a real .env or real keys.
os.environ.setdefault("OPENAI_API_KEY", "test")
os.environ.setdefault("USDA_API_KEY", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("AUTH_SECRET", "test")
os.environ.setdefault("APP_ENV", "test")
