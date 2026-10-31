"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api/client";
import { formatVolume, waterQuickAmounts } from "@/lib/format";
import { waterAmountMl, zonedInstantIso } from "@/lib/track";
import type { UnitSystem, WaterDay } from "@/lib/types/api";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function WaterSection({
  date,
  isToday,
  unit,
  timeZone,
  onChanged,
}: {
  date: string;
  isToday: boolean;
  unit: UnitSystem;
  timeZone: string;
  onChanged: () => void;
}) {
  const water = useApi<WaterDay>(`/water?day=${date}`);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      water.reload();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Today's drinks are stamped "now"; a past day's drinks go in at midday in the user's own time zone.
  const add = (ml: number) =>
    run(() =>
      api("/water", {
        method: "POST",
        body: isToday
          ? { amount_ml: ml }
          : { amount_ml: ml, consumed_at: zonedInstantIso(date, "12:00", timeZone) },
      }),
    );

  function addCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = waterAmountMl(custom, unit);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCustom("");
    void add(result.ml);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Water</CardTitle>
        <CardDescription>
          {water.data ? `${formatVolume(water.data.total_ml, unit)} so far` : "Loading…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {waterQuickAmounts(unit).map((amount) => (
            <Button key={amount.ml} type="button" variant="outline" disabled={busy} onClick={() => add(amount.ml)}>
              + {amount.label}
            </Button>
          ))}
        </div>
        <form onSubmit={addCustom} className="flex items-end gap-2" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="water-custom">Another amount ({unit === "METRIC" ? "ml" : "fl oz"})</Label>
            <Input
              id="water-custom"
              inputMode="decimal"
              className="w-32"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </form>
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error ?? water.error?.message}
        </p>
        {water.data && water.data.entries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {water.data.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
              >
                <span>
                  {formatVolume(entry.amount_ml, unit)}
                  <span className="text-muted-foreground"> · {timeOf(entry.consumed_at)}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove ${formatVolume(entry.amount_ml, unit)} at ${timeOf(entry.consumed_at)}`}
                  onClick={() => run(() => api(`/water/${entry.id}`, { method: "DELETE" }))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
