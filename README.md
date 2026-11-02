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

- **Frontend:** every screen is built in a basic, restyle-friendly form, including the AI ones: describe a
  meal in words and review it (on the Food page), chat with the fairy, meal ideas, the weekly look back,
  memories, and the evening reminder on the dashboard. Without an OpenAI key these show a calm "the
  fairy is resting" notice. Colours live in `frontend/app/globals.css` and the header links in
  `frontend/lib/nav.ts`.
- **Not yet verified:** the USDA search and the real OpenAI calls, both of which need keys in `.env`.
