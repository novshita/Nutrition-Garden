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
└── frontend/    # Next.js app (not created yet)
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
python3.11 -m venv .venv      # already created in this checkout
source .venv/bin/activate
pip install -e ".[dev]"       # once backend/pyproject.toml exists
```

### Frontend

Not scaffolded yet.

## Ground rules

- Calculations (BMI, BMR, TDEE, targets, totals, trends, garden growth) are deterministic and live in the backend. AI never calculates them.
- AI proposes; the user confirms. AI cannot change calorie targets, save memories or save uncertain food logs on its own.
- Every user-owned query derives ownership from the authenticated user.
- The core app must keep working when AI or USDA is unavailable.
- Every schema change needs an Alembic migration.
- No punishment mechanics: missing a day never reduces garden progress.

## Status

Project setup. Backend first, then frontend.
