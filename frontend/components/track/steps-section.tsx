"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api/client";
import { formatInt } from "@/lib/format";
import { stepsValue } from "@/lib/track";
import type { StepsLog } from "@/lib/types/api";

export function StepsSection({ date, onChanged }: { date: string; onChanged: () => void }) {
  const saved = useApi<StepsLog>(`/activity/${date}`);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const value = text ?? (saved.data ? String(saved.data.steps) : "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = stepsValue(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/activity/${date}`, { method: "PUT", body: { steps: result.steps } });
      setText(null);
      saved.reload();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Steps</CardTitle>
        <CardDescription>
          {saved.data ? `Saved: ${formatInt(saved.data.steps)} steps` : "How many steps did you do?"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="steps">Steps</Label>
            <Input
              id="steps"
              inputMode="numeric"
              className="w-40"
              placeholder="e.g. 2,500"
              value={value}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : saved.data ? "Update steps" : "Save steps"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
