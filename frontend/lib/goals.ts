/** Calorie goal rules: validate a new target and word the weight-trend suggestion. */

import type { CalorieSuggestion, CalorieTargetSource } from "@/lib/types/api";

// The same limits the backend enforces. The backend remains the authority.
export const MIN_TARGET_KCAL = 1200;
export const MAX_TARGET_KCAL = 6000;

export function buildTargetPayload(
  text: string,
  reason: string,
): { ok: true; payload: { target_kcal: number; reason?: string } } | { ok: false; error: string } {
  const cleaned = text.replace(/[,\s]/g, ""); // "2,300" means two thousand three hundred
  const value = cleaned === "" ? null : Number(cleaned);
  if (value === null || !Number.isInteger(value) || value < MIN_TARGET_KCAL || value > MAX_TARGET_KCAL) {
    return {
      ok: false,
      error: `Please enter a whole number of calories between ${MIN_TARGET_KCAL.toLocaleString("en-US")} and ${MAX_TARGET_KCAL.toLocaleString("en-US")}.`,
    };
  }
  const note = reason.trim();
  if (note.length > 500) return { ok: false, error: "Please keep the note under 500 characters." };
  return { ok: true, payload: note ? { target_kcal: value, reason: note } : { target_kcal: value } };
}

export const SOURCE_LABELS: Record<CalorieTargetSource, string> = {
  INITIAL_ESTIMATE: "Starting estimate",
  USER_ADJUSTED: "You changed it",
  ACCEPTED_SUGGESTION: "You accepted a suggestion",
};

export type SuggestionCopy = { headline: string; body: string; canAccept: boolean };

/** Gentle wording for each suggestion. It offers; it never insists. */
export function suggestionCopy(s: CalorieSuggestion): SuggestionCopy {
  if (s.status === "INSUFFICIENT_DATA") {
    const days = s.days_until_evaluation;
    return {
      headline: "Still gathering your trend",
      body:
        days !== null
          ? `After any change we look at about three weeks of weigh-ins before suggesting anything. ${days} more ${days === 1 ? "day" : "days"} to go, and a few weigh-ins along the way will help.`
          : "A few more weigh-ins over the last couple of weeks will let us see your trend.",
      canAccept: false,
    };
  }

  if (s.status === "REVIEW_SUGGESTED" && s.reason === "STABLE_WEIGHT" && s.suggested_target_kcal !== null) {
    const extra = s.suggested_target_kcal - s.current_target_kcal;
    return {
      headline: "Time to review your goal?",
      body: `Your weight has been steady for a few weeks. If gradual gain is what you're after, a small bump can help. Would you like to try ${s.suggested_target_kcal.toLocaleString("en-US")} kcal a day (${extra > 0 ? "+" : ""}${extra})? It's entirely your call.`,
      canAccept: true,
    };
  }

  if (s.status === "REVIEW_SUGGESTED") {
    return {
      headline: "Time to review your goal?",
      body: "Your weight has been rising faster than usual lately. You may want to take a look at your daily goal. You're in charge of it, and you can change it below any time.",
      canAccept: false,
    };
  }

  if (s.trend_state === "DECREASING" || s.trend_state === "DECREASING_FAST") {
    return {
      headline: "Your goal is yours to adjust",
      body: "Your weight has dipped a little recently. If that isn't what you were expecting, you can change your daily goal below whenever you like.",
      canAccept: false,
    };
  }
  return {
    headline: "Your goal looks fine for now",
    body: "Nothing to change right now. We'll keep an eye on your trend.",
    canAccept: false,
  };
}
