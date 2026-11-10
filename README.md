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
npm run test:e2e                 # browser tests (see below)
npm run typecheck && npm run lint
```

The browser only talks to the Next.js server. Requests to `/api/v1/*` are forwarded to the backend
(`BACKEND_URL`, default `http://127.0.0.1:8000`), so the session cookie stays same-origin and no
CORS setup is needed. Start the backend first.

If `npm install` fails with `EACCES` on `~/.npm`, your npm cache has root-owned files from an old npm
bug. Fix it once with `sudo chown -R "$(id -u):$(id -g)" ~/.npm`.

### Browser tests

`npm run test:e2e` drives a real Chromium through register, onboarding, logging food, weight and water,
every page and settings. It starts its own backend (port 8100, a throwaway `nutrition_garden_e2e`
database that is dropped and recreated each run, AI switched off) and its own Next.js server (port 3200),
so it never touches your dev data or the app on 3000/8000. One-time setup: `npx playwright install chromium`.

## Ground rules

- Calculations (BMI, BMR, TDEE, targets, totals, trends, garden growth) are deterministic and live in the backend. AI never calculates them.
- AI proposes; the user confirms. AI cannot change calorie targets, save memories or save uncertain food logs on its own.
- Every user-owned query derives ownership from the authenticated user.
- The core app must keep working when AI or USDA is unavailable.
- Every schema change needs an Alembic migration.
- No punishment mechanics: missing a day never reduces garden progress.

## AI

The fairy, natural-language food entry, meal ideas and the weekly summary use the OpenAI API, called only
from the backend. Set `OPENAI_API_KEY` in `.env`; optionally set `AI_MODEL` (the default is in
`backend/app/config.py`). Without a key the AI endpoints answer with a calm "the fairy is resting"
message, and everything else keeps working: AI is an enhancement layer, never a dependency.

### Using a free AI provider (Google Gemini)

OpenAI's API is paid. Any OpenAI-compatible provider works instead; Google Gemini has a free tier
(key from https://aistudio.google.com/apikey). In `.env`, leave `OPENAI_API_KEY=` empty and add:

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_API_KEY=<your Gemini key>
AI_MODEL=<a Gemini model name, for example gemini-2.5-flash>
```

Restart the backend. Free tiers are rate-limited, and some may use what you send to improve their
products, so check the provider's data terms before using real health details.

- AI proposes, the person decides. A food proposal is only saved through the confirm endpoint, a memory
  only becomes usable after the person approves it, and no AI code can change a goal.
- Each person has a daily AI call limit (`AI_DAILY_CALL_LIMIT` in config) so an open signup can't run up
  the bill. AI calls are made with `store=False`, and failures log only the kind of error, never what
  the person wrote.

## Status

Every feature the specs define is built, on both sides.

- **Account security:** password change (signs out other devices), display-name editing, and a limit on
  wrong passwords (`LOGIN_MAX_FAILURES` per `LOGIN_FAILURE_WINDOW_MINUTES` in `backend/app/config.py`).
- **Workouts:** templates can be edited and deleted (recorded sessions keep their names), and a session can
  record each set. **Water:** a 2 L daily goal (`WATER_TARGET_ML` in `backend/app/config.py`), shown as progress.
- **Protein:** counted and summarised for the week (`/api/v1/nutrition/protein/week`), with a gentle
  weight-based reminder (`PROTEIN_GUIDE_G_PER_KG`), never a target. **Account:** you can delete your account
  and all its data from Settings (password required).
- **Backend:** all endpoints, including AI (`/api/v1/ai/*`, `/api/v1/memory`), achievements
  (`/api/v1/garden/achievements`) and recipes (`/api/v1/recipes`).
- **Frontend:** every screen is built in a basic, restyle-friendly form. Colours live in
  `frontend/app/globals.css` and the header links in `frontend/lib/nav.ts`. Without an OpenAI key the AI
  screens show a calm "the fairy is resting" notice.
- **Not yet verified:** the USDA search and the real OpenAI calls, both of which need keys in `.env`,
  and a by-eye look at the design. Browser tests cover the main flows with AI off.
