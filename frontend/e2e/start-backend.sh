#!/usr/bin/env bash
# Starts a throwaway backend for the browser tests: its own database (dropped and recreated every
# run, so it never touches your dev data) and AI switched off (no OpenAI or USDA key).
set -euo pipefail
cd "$(dirname "$0")/../../backend"

URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' ../.env | head -1 | cut -d= -f2-)}"
E2E_DB="nutrition_garden_e2e"
export DATABASE_URL="${URL%/*}/${E2E_DB}"
ADMIN_URL="${URL%/*}/postgres"
ADMIN_URL="${ADMIN_URL/+psycopg/}"

dropdb --maintenance-db="$ADMIN_URL" --if-exists "$E2E_DB"
createdb --maintenance-db="$ADMIN_URL" "$E2E_DB"

export OPENAI_API_KEY="" AI_API_KEY="" AI_BASE_URL="" AI_MODEL="" SMTP_HOST="" USDA_API_KEY="" AUTH_SECRET="e2e-only-secret" APP_ENV="development"
.venv/bin/alembic upgrade head
exec .venv/bin/uvicorn app.main:app --port 8100
