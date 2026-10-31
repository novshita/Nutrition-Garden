"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { suggestionCopy } from "@/lib/goals";
import type { CalorieSuggestion } from "@/lib/types/api";

export function SuggestionCard({
  suggestion,
  onAccepted,
}: {
  suggestion: CalorieSuggestion;
  onAccepted: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = suggestionCopy(suggestion);

  async function accept() {
    if (suggestion.suggested_target_kcal === null) return;
    setBusy(true);
    setError(null);
    try {
      await api("/goals/calorie-target/suggestion/accept", {
        method: "POST",
        body: { target_kcal: suggestion.suggested_target_kcal },
      });
      onAccepted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.headline}</CardTitle>
        <CardDescription>A look at your weight trend</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">{copy.body}</p>
        {copy.canAccept && !dismissed && (
          <div className="flex gap-2">
            <Button type="button" onClick={accept} disabled={busy}>
              {busy ? "Saving…" : `Try ${suggestion.suggested_target_kcal?.toLocaleString("en-US")} kcal`}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          </div>
        )}
        {dismissed && <p className="text-sm text-muted-foreground">No problem. Your goal stays as it is.</p>}
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
      </CardContent>
    </Card>
  );
}
