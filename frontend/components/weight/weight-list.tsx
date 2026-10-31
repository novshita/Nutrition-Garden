"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { formatShortDate, formatWeight } from "@/lib/format";
import type { UnitSystem, WeightEntry } from "@/lib/types/api";
import { localDate } from "@/lib/weight";

export function WeightList({
  entries,
  unit,
  timeZone,
  onChanged,
}: {
  entries: WeightEntry[];
  unit: UnitSystem;
  timeZone: string;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/weight/${id}`, { method: "DELETE" });
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "Your only weigh-in can't be removed. Log another one first."
          : caught instanceof ApiError
            ? caught.message
            : "Something went wrong.",
      );
    }
  }

  const newestFirst = [...entries].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weigh-ins</CardTitle>
        <CardDescription>
          {entries.length === 0 ? "Nothing in this time range yet." : "Typed one wrong? You can remove it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {newestFirst.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{formatWeight(entry.weight_kg, unit)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatShortDate(localDate(entry.recorded_at, timeZone))}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove ${formatWeight(entry.weight_kg, unit)} on ${formatShortDate(localDate(entry.recorded_at, timeZone))}`}
                onClick={() => remove(entry.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
