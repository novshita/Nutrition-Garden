"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api/client";
import { formatDuration } from "@/lib/format";
import { buildSleepPayload, emptySleepForm, type SleepForm } from "@/lib/track";
import type { SleepLog } from "@/lib/types/api";

const QUALITY_LABELS = ["1 · restless", "2", "3 · okay", "4", "5 · restful"];

export function SleepSection({
  date,
  timeZone,
  onChanged,
}: {
  date: string;
  timeZone: string;
  onChanged: () => void;
}) {
  const saved = useApi<SleepLog>(`/sleep/${date}`);
  const [form, setForm] = useState<SleepForm>(emptySleepForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SleepForm>(key: K, value: SleepForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildSleepPayload(form, date, timeZone);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/sleep/${date}`, { method: "PUT", body: result.payload });
      saved.reload();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const log = saved.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep</CardTitle>
        <CardDescription>
          {log
            ? `Saved: ${formatDuration(log.duration_minutes)}${log.quality ? ` · quality ${log.quality}/5` : ""}`
            : saved.error && saved.error.status !== 404
              ? saved.error.message
              : "Nothing saved for this night yet."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex gap-2" role="group" aria-label="How to enter sleep">
            <Button
              type="button"
              size="sm"
              variant={form.mode === "times" ? "default" : "outline"}
              aria-pressed={form.mode === "times"}
              onClick={() => set("mode", "times")}
            >
              Bedtime and wake-up
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.mode === "total" ? "default" : "outline"}
              aria-pressed={form.mode === "total"}
              onClick={() => set("mode", "total")}
            >
              Just the total
            </Button>
          </div>

          {form.mode === "times" ? (
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sleep-bed">Went to bed</Label>
                <Input id="sleep-bed" type="time" value={form.bedtime} onChange={(e) => set("bedtime", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sleep-wake">Woke up</Label>
                <Input id="sleep-wake" type="time" value={form.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sleep-hours">Hours</Label>
                <Input id="sleep-hours" inputMode="numeric" className="w-20" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sleep-minutes">Minutes</Label>
                <Input id="sleep-minutes" inputMode="numeric" className="w-20" value={form.minutes} onChange={(e) => set("minutes", e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="sleep-quality">How did you sleep? (optional)</Label>
            <NativeSelect id="sleep-quality" value={form.quality} onChange={(e) => set("quality", e.target.value)}>
              <option value="">Skip</option>
              {QUALITY_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sleep-notes">Notes (optional)</Label>
            <Input id="sleep-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : log ? "Update sleep" : "Save sleep"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
