FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Dependencies first, so a code change doesn't reinstall them.
COPY pyproject.toml ./
RUN mkdir app && touch app/__init__.py && pip install . && rm -rf app

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN useradd --create-home garden
USER garden
EXPOSE 8000

# Bring the database up to date, then start the API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
