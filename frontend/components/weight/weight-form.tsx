"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { UnitSystem } from "@/lib/types/api";
import { buildWeightPayload, todayIn } from "@/lib/weight";

export function WeightForm({
  unit,
  timeZone,
  onSaved,
}: {
  unit: UnitSystem;
  timeZone: string;
  onSaved: () => void;
}) {
  const today = todayIn(timeZone);
  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildWeightPayload({ text, unit, note, date, today, timeZone });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/weight", { method: "POST", body: result.payload });
      setText("");
      setNote("");
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log your weight</CardTitle>
        <CardDescription>
          Once in a while is plenty. The trend smooths out the day-to-day ups and downs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="weight-value">Weight ({unit === "METRIC" ? "kg" : "lb"})</Label>
              <Input
                id="weight-value"
                inputMode="decimal"
                className="w-32"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="weight-date">Day</Label>
              <Input
                id="weight-date"
                type="date"
                className="w-44"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="weight-note">Note (optional)</Label>
            <Input id="weight-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : "Save weight"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
