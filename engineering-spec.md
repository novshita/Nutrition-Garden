# ⚙️ Personal Nutrition Garden
## Engineering Specification V1.0

**Status:** Engineering Baseline  
**Purpose:** Source of truth for implementation behavior  
**Parent specification:** product-spec.md  
**Audience:** Developers and AI coding agents

---

# 1. Implementation Principle

The application must be developed using spec-driven development.

The coding agent must NOT invent product behavior when a requirement is already defined in:

`product-spec.md`

The coding agent must NOT invent technical behavior when it is defined in:

`engineering-spec.md`

If a requirement is genuinely undefined or contradictory, stop implementation and request clarification.

Do not silently make major product decisions.

---

# 2. Architecture

The application uses:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- OpenAI API
- USDA FoodData Central API

Architecture:

Browser
→ Next.js frontend
→ FastAPI backend
→ PostgreSQL

FastAPI communicates with:

- OpenAI
- USDA FoodData Central

External API keys must remain server-side.

---

# 3. Responsibility Boundaries

## Frontend

Responsible for:

- UI
- forms
- interaction
- visualizations
- animations
- garden rendering
- user feedback

## Backend

Responsible for:

- validation
- calculations
- business rules
- authentication
- authorization
- persistence
- AI orchestration
- garden progression

## AI

Responsible for:

- natural-language interpretation
- meal recommendations
- conversational responses
- summaries
- personalization

AI must NOT be the authoritative calculation engine.

---

# 4. Canonical Units

Store internally:

- weight → kilograms
- height → centimeters
- water → millilitres
- sleep → minutes
- workout duration → seconds

Frontend converts to/from the user's preferred unit system.

---

# 5. User

Table:

user

Fields:

- id
- email
- display_name
- created_at
- updated_at

---

# 6. User Profile

Table:

user_profile

Fields:

- id
- user_id
- date_of_birth
- sex
- height_cm
- preferred_unit_system
- activity_level
- goal_type
- goal_weight_kg
- timezone
- created_at
- updated_at

Unit enum:

METRIC
IMPERIAL

---

# 7. Weight

Table:

weight_log

Fields:

- id
- user_id
- recorded_at
- weight_kg
- note
- created_at

Validation:

- weight must be greater than zero
- reject invalid numeric values
- reject malformed requests

---

# 8. BMI

Formula:

BMI = weight_kg / height_m²

BMI is derived from the current valid weight and stored height.

BMI should not be stored as the authoritative source.

BMI is informational.

---

# 9. BMR

Use the Mifflin-St Jeor equation.

Male:

BMR =
10 × weight_kg
+
6.25 × height_cm
-
5 × age
+
5

Female:

BMR =
10 × weight_kg
+
6.25 × height_cm
-
5 × age
-
161

BMR calculations belong to the backend.

AI must never calculate the authoritative BMR.

---

# 10. Activity Multipliers

Initial configurable values:

SEDENTARY = 1.20
LIGHT = 1.375
MODERATE = 1.55
VERY_ACTIVE = 1.725
EXTRA_ACTIVE = 1.90

These values must be centralized in configuration.

---

# 11. TDEE

TDEE = BMR × activity multiplier

The backend calculates TDEE.

---

# 12. Initial Calorie Target

Initial default:

TDEE + 250 kcal/day

This is an application estimate and not medical advice.

The user must be able to review the target.

---

# 13. Calorie Target History

Table:

calorie_target

Fields:

- id
- user_id
- target_kcal
- source
- reason
- effective_from
- effective_until
- created_at

Never overwrite historical targets.

---

# 14. Adaptive Calorie Logic

Evaluate approximately 3–4 weeks of weight data.

If insufficient data exists:

Return:

INSUFFICIENT_DATA

Do not make a target recommendation.

If weight remains approximately stable:

Recommend reviewing the target.

Initial adjustment suggestion:

+100 kcal/day

If weight increases faster than expected:

Recommend reviewing the target.

The application must not silently apply the new target.

---

# 15. Weight Trend

Use a 7-day rolling average where sufficient data exists.

Trend states:

INSUFFICIENT_DATA
STABLE
INCREASING
DECREASING
INCREASING_FAST
DECREASING_FAST

Thresholds must be configurable.

Do not determine a long-term trend from one measurement.

---

# 16. Food Log

Table:

food_log

Fields:

- id
- user_id
- consumed_at
- meal_type
- source
- notes
- created_at
- updated_at

---

# 17. Food Log Item

Table:

food_log_item

Fields:

- id
- food_log_id
- food_source
- external_food_id
- food_name
- quantity
- unit
- serving_size
- calories
- protein_g
- carbohydrate_g
- fat_g
- fiber_g
- micronutrients_json
- confidence
- created_at

Nutrition values are snapshots.

Historical food logs must not silently change if external nutrition data changes.

---

# 18. Food Sources

Allowed values:

USDA
CUSTOM
AI_INTERPRETED

---

# 19. USDA Integration

Use USDA FoodData Central.

The backend should provide:

GET /api/v1/food/search
GET /api/v1/food/{fdc_id}

USDA responses should be normalized into the application's internal nutrition model.

Cache frequently used food records.

Do not expose the USDA API key to the frontend.

---

# 20. AI Food Interpretation

Endpoint:

POST /api/v1/ai/food-interpretation

AI should return structured information.

Conceptual schema:

FoodInterpretation:

- items[]
  - food_name
  - quantity
  - unit
  - preparation_method
  - confidence
- meal_context
- assumptions[]
- needs_clarification
- clarification_question

AI output must be validated using Pydantic.

Where supported, use structured model output/schema enforcement.

---

# 21. AI Food Safety Rule

AI food interpretation is a proposal.

It must NOT automatically create a permanent food log when uncertainty exists.

Flow:

User input
→ AI interpretation
→ backend validation
→ user review
→ confirmation
→ nutrition lookup
→ food log

---

# 22. Nutrition Totals

Daily totals are calculated by the backend.

Calories:

SUM(food_log_item.calories)

Protein:

SUM(food_log_item.protein_g)

Carbohydrates:

SUM(food_log_item.carbohydrate_g)

Fat:

SUM(food_log_item.fat_g)

Fiber:

SUM(food_log_item.fiber_g)

Do not calculate authoritative totals only on the frontend.

---

# 23. Missing Nutrition Data

Missing nutrient values must be represented as NULL.

Do not automatically convert NULL into zero.

---

# 24. Workout Template

Table:

workout_template

Fields:

- id
- user_id
- name
- description
- difficulty
- created_at
- updated_at

---

# 25. Workout Exercise

Table:

workout_exercise

Fields:

- id
- template_id
- exercise_name
- exercise_type
- order_index
- default_sets
- default_reps
- default_duration_seconds
- rest_seconds

---

# 26. Exercise Types

REPS
TIME
COMBINED

Categories:

UPPER_BODY
LOWER_BODY
CORE
FULL_BODY
CARDIO
HIIT
MOBILITY
STRETCHING
YOGA

---

# 27. Workout Schedule

Table:

workout_schedule

Fields:

- id
- user_id
- weekday
- template_id
- is_rest_day

The user's existing routine should be supported:

Monday → Upper Body
Tuesday → Upper Body
Wednesday → Rest
Thursday → Lower Body
Friday → Lower Body

The schedule must remain editable.

---

# 28. Workout Session

Table:

workout_session

Fields:

- id
- user_id
- template_id
- started_at
- completed_at
- duration_seconds
- estimated_calories
- notes

---

# 29. Workout Set

Table:

workout_set

Fields:

- id
- session_id
- exercise_id
- set_number
- repetitions
- duration_seconds
- completed

---

# 30. Workout Calories

Workout calories are estimates.

They must NOT modify:

daily_calorie_target

Workout calories and food targets remain separate.

---

# 31. Steps

Table:

daily_activity

Fields:

- id
- user_id
- date
- steps
- created_at
- updated_at

Steps are manually entered in V1.

No phone/wearable synchronization is required.

Validation:

steps >= 0

---

# 32. Water

Table:

water_log

Fields:

- id
- user_id
- consumed_at
- amount_ml

Daily water:

SUM(amount_ml)

Validation:

amount_ml >= 0

---

# 33. Sleep

Table:

sleep_log

Fields:

- id
- user_id
- sleep_date
- bedtime
- wake_time
- duration_minutes
- quality
- notes

Duration should be calculated from timestamps where possible.

---

# 34. Mood

Table:

mood_log

Fields:

- id
- user_id
- date
- mood
- note

Mood values:

GREAT
GOOD
OKAY
LOW
ROUGH

---

# 35. Garden

Table:

garden

Fields:

- id
- user_id
- name
- created_at
- updated_at

---

# 36. Garden Progress

Table:

garden_progress

Fields:

- id
- garden_id
- growth_points
- growth_stage
- updated_at

---

# 37. Garden Items

Table:

garden_item

Fields:

- id
- garden_id
- item_type
- item_key
- position
- rotation
- metadata_json
- unlocked_at

---

# 38. Garden Growth

Garden growth is deterministic.

Positive activities can contribute growth.

Possible actions:

- food logged
- calorie target reasonably met
- protein target reasonably met
- workout completed
- steps logged
- water logged
- sleep logged
- mood logged
- weight logged

Initial implementation may use one positive growth point per completed action.

The algorithm must be configurable.

---

# 39. Garden Punishment Rule

Garden progress must never become negative because the user missed an activity.

Do NOT implement:

- negative growth points
- streak destruction
- punishment states
- shame messaging

---

# 40. Bunny Evolution

Bunny evolution depends on garden growth stage.

Initial configurable stages may be:

stage 1 = 0 points
stage 2 = 50 points
stage 3 = 150 points
stage 4 = 300 points
stage 5 = 500 points

These are configuration values, not hardcoded UI logic.

---

# 41. Garden Milestones

Table:

garden_milestone

Fields:

- id
- garden_id
- milestone_type
- trigger_value
- unlocked_at

Possible milestone types:

FIRST_LOG
FIRST_WEEK
WORKOUT_STREAK
HYDRATION_MILESTONE
WEIGHT_MILESTONE
GARDEN_STAGE

---

# 42. Garden Customization

Customization state must persist in the database.

The frontend must not treat local UI state as the source of truth for saved garden configuration.

---

# 43. AI Memory

Table:

ai_memory

Fields:

- id
- user_id
- category
- memory_text
- status
- created_at
- updated_at

Status:

PENDING
APPROVED
REJECTED
ARCHIVED

Only APPROVED memories may be used as long-term AI context.

---

# 44. AI Memory Rule

The AI must never silently store long-term personal preferences.

Flow:

AI detects possible memory
→ user confirmation
→ backend validation
→ database persistence

---

# 45. AI Context

AI context should be assembled from only relevant information.

Possible context:

- profile
- today's nutrition
- workout schedule
- recent weight trend
- approved memories
- garden state

Do not send the entire database to the model.

---

# 46. AI Meal Recommendation

Conceptual schema:

MealRecommendation:

- title
- description
- estimated_calories
- estimated_protein
- reasoning
- ingredients[]
- alternatives[]
- confidence

AI nutrition estimates should be validated against the nutrition layer when exact values are required.

---

# 47. Fairy Behavior

The fairy may:

- answer nutrition questions
- interpret food
- recommend meals
- explain trends
- summarize weeks
- recognize planned workouts
- provide gentle reminders

The fairy must not:

- shame the user
- pressure the user
- diagnose medical conditions
- silently change goals
- directly execute database operations

---

# 48. Proactive Fairy

If the user has eaten significantly below their target by evening, the fairy may provide one gentle reminder.

Use cooldown logic.

Example:

Maximum nutrition reminder:

once per day

Avoid repetitive notifications.

---

# 49. Calendar

The calendar should aggregate domain data.

It should display relevant:

- workouts
- nutrition activity
- weight
- water
- sleep
- mood

The calendar should not create duplicate copies of domain data.

---

# 50. Authentication

Use secure server-side session authentication.

Recommended:

- secure HTTP-only cookies
- HTTPS in production
- server-side session validation

Do not store authentication tokens in localStorage.

---

# 51. Authorization

All user-owned queries must derive ownership from the authenticated user.

Do not trust frontend-supplied user_id values.

Every query must enforce user ownership.

---

# 52. Timezone

Store timestamps in UTC.

Store the user's timezone.

Interpret daily records using the user's local timezone.

This applies to:

- food
- water
- sleep
- workouts
- mood
- weight
- calendar
- summaries

---

# 53. Environment Variables

Required:

OPENAI_API_KEY
USDA_API_KEY
DATABASE_URL
AUTH_SECRET
APP_ENV

Optional:

AI_MODEL
LOG_LEVEL

Secrets must never be committed to source control.

---

# 54. Database

Use PostgreSQL.

Use SQLAlchemy for ORM/database access.

Use Alembic for migrations.

Every schema change must have a migration.

Do not manually change production schema.

---

# 55. API Versioning

All application APIs should begin with:

/api/v1/

---

# 56. API Groups

/api/v1/auth
/api/v1/profile
/api/v1/dashboard
/api/v1/food
/api/v1/nutrition
/api/v1/weight
/api/v1/bmi
/api/v1/goals
/api/v1/workouts
/api/v1/activity
/api/v1/water
/api/v1/sleep
/api/v1/mood
/api/v1/calendar
/api/v1/garden
/api/v1/ai
/api/v1/memory

---

# 57. Dashboard API

GET:

/api/v1/dashboard/today

Conceptual response:

{
  "date": "YYYY-MM-DD",
  "calories": {
    "consumed": 0,
    "target": 0
  },
  "protein": {
    "consumed_g": 0,
    "target_g": 0
  },
  "water_ml": 0,
  "sleep_minutes": 0,
  "steps": 0,
  "mood": null,
  "weight_kg": null
}

The actual response schema must be represented by Pydantic models.

---

# 58. Food Endpoints

GET /api/v1/food/search
GET /api/v1/food/{fdc_id}
POST /api/v1/food/log
POST /api/v1/ai/food-interpretation

AI interpretation must return a proposal.

---

# 59. Weight Endpoints

POST /api/v1/weight
GET /api/v1/weight
GET /api/v1/weight/trend

---

# 60. Workout Endpoints

GET /api/v1/workouts/templates
POST /api/v1/workouts/templates
GET /api/v1/workouts/schedule
PUT /api/v1/workouts/schedule
POST /api/v1/workouts/sessions
GET /api/v1/workouts/sessions

---

# 61. Garden Endpoints

GET /api/v1/garden
GET /api/v1/garden/items
POST /api/v1/garden/items/{item_id}/place
GET /api/v1/garden/milestones

Garden progression must be calculated server-side.

---

# 62. AI Endpoints

POST /api/v1/ai/food-interpretation
POST /api/v1/ai/meal-recommendation
POST /api/v1/ai/chat
POST /api/v1/ai/weekly-summary

---

# 63. Validation

All API requests must use Pydantic validation.

Validate:

- numbers
- dates
- enums
- units
- required fields
- ownership
- ranges

Reject invalid input before business logic executes.

---

# 64. Error Handling

Never expose:

- stack traces
- SQL statements
- API keys
- internal filesystem paths
- infrastructure details

External service failures should return safe user-facing errors.

---

# 65. AI Failure

The core application must continue working if AI is unavailable.

The following must not depend on AI:

- food database search
- food logging
- nutrition totals
- BMI
- BMR
- TDEE
- weight tracking
- water tracking
- sleep tracking
- mood tracking
- workout tracking
- garden progression

AI is an enhancement layer.

---

# 66. External API Failure

If USDA is unavailable:

The user should still be able to:

- retry
- use previously cached foods
- manually enter food

If AI is unavailable:

Normal manual food logging must continue working.

---

# 67. Testing

Required testing layers:

## Unit tests

Test:

- BMI
- BMR
- TDEE
- calorie target
- nutrition totals
- weight trends
- sleep duration
- garden growth
- bunny evolution

## Integration tests

Test:

- API + database
- USDA
- AI orchestration
- authentication
- food logging

## End-to-end tests

Test:

Onboarding
→ body information
→ calorie target
→ food logging
→ weight logging
→ workout
→ water
→ sleep
→ mood
→ steps
→ summary
→ garden

---

# 68. Mandatory Business-Logic Tests

The following tests are mandatory:

1. Workout calories cannot change food target.

2. AI cannot directly modify calorie targets.

3. AI cannot directly persist memories.

4. Unconfirmed AI food interpretation cannot become a saved food record.

5. NULL nutrition values are not treated as zero.

6. Missing activities cannot reduce garden progress.

7. Insufficient weight data cannot trigger calorie adjustment.

8. Weight trends cannot be determined from a single measurement.

9. User A cannot access User B's records.

10. Unit conversions must be reversible within acceptable precision.

---

# 69. Acceptance Criteria

## Onboarding

Must:

- accept metric units
- accept imperial units
- convert correctly
- calculate BMI
- calculate BMR
- calculate TDEE
- generate initial calorie target
- store profile

## Food

Must:

- search foods
- select serving
- calculate nutrition
- save food
- interpret natural language
- request clarification when necessary
- require confirmation for uncertain AI interpretation

## Weight

Must:

- save weight
- show historical graph
- calculate BMI
- calculate trend
- handle insufficient data

## Workouts

Must:

- create templates
- schedule workouts
- support home/bodyweight exercises
- support rep-based exercises
- support time-based exercises
- record completed sessions
- estimate workout calories

## Daily tracking

Must:

- record steps
- record water
- record sleep
- record mood
- produce daily summary

## Garden

Must:

- show garden
- show bunny
- calculate growth
- unlock milestones
- persist customization
- evolve bunny

## AI

Must:

- answer questions
- interpret food
- recommend meals
- understand planned workouts
- summarize trends
- use approved memories
- respect data boundaries

---

# 70. Project Structure

Backend:

backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   └── v1/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── nutrition/
│   │   ├── ai/
│   │   ├── calculations/
│   │   ├── workouts/
│   │   └── garden/
│   ├── repositories/
│   ├── db/
│   └── tests/
├── alembic/
└── pyproject.toml

Frontend:

frontend/
├── app/
├── components/
│   ├── garden/
│   ├── bunny/
│   ├── fairy/
│   ├── nutrition/
│   ├── workouts/
│   ├── charts/
│   └── ui/
├── lib/
│   ├── api/
│   ├── types/
│   └── utils/
├── hooks/
├── public/
└── tests/

---

# 71. AI Coding Agent Rules

The coding agent MUST:

1. Read product-spec.md before implementation.
2. Read engineering-spec.md before implementation.
3. Follow existing architecture.
4. Not invent major product behavior.
5. Not move business logic into the frontend.
6. Not allow AI to bypass backend validation.
7. Write tests for business logic.
8. Update migrations when schemas change.
9. Keep API schemas explicit.
10. Keep secrets out of source control.
11. Avoid unnecessary dependencies.
12. Avoid speculative features.
13. Avoid implementing V2 features during V1.
14. Explain deviations from the specification.
15. Never replace working functionality merely for stylistic reasons.

---

# 72. No Vibe Coding

Do not implement a feature using vague instructions such as:

"Make a cute calorie tracker."

Every implementation task must define:

- objective
- relevant product requirement
- technical behavior
- inputs
- outputs
- validation
- API behavior
- acceptance criteria
- tests

---

# 73. Definition of Done

A feature is complete only when:

Requirement
→ implementation
→ validation
→ business logic
→ API
→ UI integration
→ tests
→ acceptance criteria
→ regression check

All required steps must pass.

---

# 74. Specification Priority

When resolving conflicts:

1. Explicit user/product requirement
2. product-spec.md
3. engineering-spec.md
4. existing approved architecture
5. implementation convention

If two specifications conflict:

STOP.

Do not silently choose one.

Ask for clarification.

---

# 75. V1 Exclusions

Do NOT implement unless explicitly approved later:

- food photo recognition
- automatic phone step synchronization
- wearable integrations
- social features
- public profiles
- leaderboards
- gym equipment requirements
- dumbbell-based workouts
- medical diagnosis
- automated medical recommendations

---

# 76. Future Specification Phases

The following should be created separately rather than expanding this file indefinitely:

UX Specification V1.0
Design System V1.0
Database Migration Plan
API/OpenAPI Specification
AI Prompt Specification
Testing Plan

These documents should not be mixed into the product specification.

---

# 77. Engineering Principle

The system should remain:

- deterministic where calculations are involved
- AI-assisted where language understanding is useful
- user-controlled where decisions affect goals
- forgiving when habits are missed
- modular enough for future expansion

The architecture should support the product philosophy:

> The garden grows because the user takes care of themselves — not because they are perfect.