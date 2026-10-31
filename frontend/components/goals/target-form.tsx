"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { buildTargetPayload, MAX_TARGET_KCAL, MIN_TARGET_KCAL } from "@/lib/goals";

export function TargetForm({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildTargetPayload(text, reason);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/goals/calorie-target", { method: "PUT", body: result.payload });
      setText("");
      setReason("");
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
        <CardTitle>Change your daily goal</CardTitle>
        <CardDescription>
          It&apos;s an estimate, and it&apos;s yours to adjust. Anything from {MIN_TARGET_KCAL.toLocaleString("en-US")} to{" "}
          {MAX_TARGET_KCAL.toLocaleString("en-US")} kcal. Your earlier goals are kept in the history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="goal-kcal">New daily goal (kcal)</Label>
            <Input id="goal-kcal" inputMode="numeric" className="w-40" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="goal-reason">Why? (optional)</Label>
            <Input id="goal-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : "Save goal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
