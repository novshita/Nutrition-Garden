# 🌷 Personal Nutrition Garden

A personal, desktop-first calorie and wellness app built around healthy weight gain. It tracks food, weight, home workouts, water, sleep, mood and steps. Your progress grows a garden and evolves a companion bunny, and an AI fairy offers gentle guidance.

> The garden grows because you take care of yourself, not because you are perfect.

## Specifications (source of truth)

Development is spec-driven. Read these before changing anything.

| Document | Purpose |
| --- | --- |
| [product-spec.md](product-spec.md) | What the application should do |
| [engineering-spec.md](engineering-spec.md) | How it must be built |

If the specs are undefined or conflict, stop and ask rather than guessing. Priority: user requirement → product spec → engineering spec → existing architecture → convention.

## Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **External:** OpenAI API, USDA FoodData Central (keys stay server-side)

```
Browser → Next.js frontend → FastAPI backend → PostgreSQL
                                  ↳ OpenAI, USDA FoodData Central
```

## Project layout

```
Nutrition-Garden/
├── product-spec.md
├── engineering-spec.md
├── .env.example
├── backend/     # FastAPI app (see engineering-spec §70)
└── frontend/    # Next.js app
```

## Getting started

### Prerequisites

- Python 3.11
- Node.js (for the frontend)
- PostgreSQL

### Configuration

```bash
cp .env.example .env   # then fill in the values
```

Never commit `.env`. Required variables: `OPENAI_API_KEY`, `USDA_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `APP_ENV`.

### Backend

```bash
cd backend
source .venv/bin/activate        # python3.11 -m venv .venv if you don't have one yet
pip install -e ".[dev]"
createdb nutrition_garden && createdb nutrition_garden_test
alembic upgrade head             # create the tables
uvicorn app.main:app --reload    # http://127.0.0.1:8000  (API docs at /docs)
pytest                           # tests use the nutrition_garden_test database
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
npm test                         # unit tests
npm run typecheck && npm run lint
```

The browser only talks to the Next.js server. Requests to `/api/v1/*` are forwarded to the backend
(`BACKEND_URL`, default `http://127.0.0.1:8000`), so the session cookie stays same-origin and no
CORS setup is needed. Start the backend first.

If `npm install` fails with `EACCES` on `~/.npm`, your npm cache has root-owned files from an old npm
bug. Fix it once with `sudo chown -R "$(id -u):$(id -g)" ~/.npm`.

## Ground rules

- Calculations (BMI, BMR, TDEE, targets, totals, trends, garden growth) are deterministic and live in the backend. AI never calculates them.
- AI proposes; the user confirms. AI cannot change calorie targets, save memories or save uncertain food logs on its own.
- Every user-owned query derives ownership from the authenticated user.
- The core app must keep working when AI or USDA is unavailable.
- Every schema change needs an Alembic migration.
- No punishment mechanics: missing a day never reduces garden progress.

## Status

- **Backend:** complete except the AI layer (food interpretation, memory, the fairy).
- **Frontend:** every screen the backend supports is built in a basic, restyle-friendly form: login and
  registration, onboarding, dashboard, food, daily check-in, weight, workouts, garden, calendar and the
  calorie goal. Styling is intentionally plain; colours live in `frontend/app/globals.css` and the
  header links in `frontend/lib/nav.ts`.
- **Not built yet:** the AI screens and backend, achievements and recipes (the specs don't define them),
  and a check of the USDA search with a real API key.
