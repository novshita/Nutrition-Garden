"use client";

import { useState, type FormEvent } from "react";
import { AiUnavailable } from "@/components/fairy/ai-unavailable";
import { ReviewRow } from "@/components/food/review-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";
import {
  MAX_FOOD_TEXT,
  buildConfirmPayload,
  buildReviewItems,
  combineClarification,
  mealFromContext,
  validateMessage,
  type ReviewItem,
} from "@/lib/ai";
import { api, ApiError } from "@/lib/api/client";
import { defaultMealType, MEAL_LABELS, MEAL_ORDER } from "@/lib/food";
import type { AiStatus, FoodInterpretation, FoodInterpretationResponse, FoodLog, MealType } from "@/lib/types/api";

/** Describe a meal in your own words, check what the fairy understood, then save it. */
export function AiFoodEntry({ onSaved }: { onSaved: () => void }) {
  const status = useApi<AiStatus>("/ai/status");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [proposal, setProposal] = useState<FoodInterpretation | null>(null);
  const [asked, setAsked] = useState(""); // the text the proposal was made from
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date().getHours()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status.loading) return <p className="text-sm text-muted-foreground">Waking the fairy…</p>;
  if (!status.data?.available) return <AiUnavailable />;

  async function interpret(sourceText: string) {
    const problem = validateMessage(sourceText, MAX_FOOD_TEXT);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api<FoodInterpretationResponse>("/ai/food-interpretation", {
        method: "POST",
        body: { text: sourceText.trim() },
      });
      setProposal(response.interpretation);
      setItems(buildReviewItems(response));
      setAsked(sourceText.trim());
      setAnswer("");
      const hinted = mealFromContext(response.interpretation.meal_context);
      if (hinted) setMealType(hinted);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const result = buildConfirmPayload(items, mealType, asked);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<FoodLog>("/ai/food-interpretation/confirm", { method: "POST", body: result.body });
      setProposal(null);
      setItems([]);
      setText("");
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const update = (key: string, changes: Partial<ReviewItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  if (proposal === null) {
    return (
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void interpret(text);
        }}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="ai-food-text">What did you eat?</Label>
          <Input
            id="ai-food-text"
            value={text}
            maxLength={MAX_FOOD_TEXT}
            placeholder="I had two eggs and toast"
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The fairy reads it and you check it before anything is saved.
          </p>
        </div>
        <p role="alert" className="min-h-5 text-sm text-destructive">
          {error}
        </p>
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Reading…" : "Read my meal"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-medium">You said:</span> “{asked}”
      </p>

      {proposal.needs_clarification && proposal.clarification_question && (
        <div className="flex flex-col gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <p>🧚 {proposal.clarification_question}</p>
          <div className="flex gap-2">
            <Input
              aria-label="Your answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer…"
            />
            <Button type="button" size="sm" disabled={busy || !answer.trim()} onClick={() => interpret(combineClarification(asked, answer))}>
              Ask again
            </Button>
          </div>
          <p className="text-xs opacity-80">Or just fill in the amounts below yourself.</p>
        </div>
      )}

      {proposal.assumptions.length > 0 && (
        <p className="text-xs text-muted-foreground">I assumed: {proposal.assumptions.join("; ")}.</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">I couldn&apos;t find any food in that. Try describing it again.</p>
      ) : (
        items.map((item) => <ReviewRow key={item.key} item={item} onChange={(changes) => update(item.key, changes)} />)
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="ai-meal-type">Which meal?</Label>
        <NativeSelect id="ai-meal-type" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
          {MEAL_ORDER.map((meal) => (
            <option key={meal} value={meal}>
              {MEAL_LABELS[meal]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <p role="alert" className="min-h-5 text-sm text-destructive">
        {error}
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={busy || items.length === 0}>
          {busy ? "Saving…" : "Looks right, save it"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setProposal(null);
            setItems([]);
            setError(null);
          }}
        >
          Start over
        </Button>
      </div>
    </div>
  );
}
