"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api/client";
import type { Mood, MoodLog } from "@/lib/types/api";

const MOODS: { value: Mood; label: string }[] = [
  { value: "GREAT", label: "😄 Great" },
  { value: "GOOD", label: "🙂 Good" },
  { value: "OKAY", label: "😐 Okay" },
  { value: "LOW", label: "😔 Low" },
  { value: "ROUGH", label: "😣 Rough" },
];

export function MoodSection({ date, onChanged }: { date: string; onChanged: () => void }) {
  const saved = useApi<MoodLog>(`/mood/${date}`);
  const [picked, setPicked] = useState<Mood | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mood = picked ?? saved.data?.mood ?? null;
  const noteText = note ?? saved.data?.note ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mood) {
      setError("Pick the one that fits best.");
      return;
    }
    if (noteText.length > 500) {
      setError("Please keep the note under 500 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/mood/${date}`, {
        method: "PUT",
        body: noteText.trim() ? { mood, note: noteText.trim() } : { mood },
      });
      setPicked(null);
      setNote(null);
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
        <CardTitle>Mood</CardTitle>
        <CardDescription>
          {saved.data
            ? `Saved: ${MOODS.find((m) => m.value === saved.data!.mood)?.label}`
            : "How are you feeling?"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
            {MOODS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={mood === option.value ? "default" : "outline"}
                aria-pressed={mood === option.value}
                onClick={() => setPicked(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mood-note">A note (optional)</Label>
            <Input id="mood-note" value={noteText} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : saved.data ? "Update mood" : "Save mood"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
