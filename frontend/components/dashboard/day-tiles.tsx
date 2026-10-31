"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { formatDuration, formatInt, formatVolume, formatWeight, waterQuickAmounts } from "@/lib/format";
import type { DayOverview, Mood, UnitSystem } from "@/lib/types/api";

const MOOD_LABELS: Record<Mood, string> = {
  GREAT: "😄 Great",
  GOOD: "🙂 Good",
  OKAY: "😐 Okay",
  LOW: "😔 Low",
  ROUGH: "😣 Rough",
};

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <h2 className="text-sm text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

const Value = ({ children }: { children: ReactNode }) => (
  <p className="text-xl font-semibold">{children}</p>
);
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

function WaterTile({
  ml,
  unit,
  onAdded,
}: {
  ml: number;
  unit: UnitSystem;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(amountMl: number) {
    setBusy(true);
    setError(null);
    try {
      await api("/water", { method: "POST", body: { amount_ml: amountMl } });
      onAdded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tile title="Water">
      <Value>{formatVolume(ml, unit)}</Value>
      <div className="mt-2 flex flex-wrap gap-2">
        {waterQuickAmounts(unit).map((amount) => (
          <Button
            key={amount.ml}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => add(amount.ml)}
          >
            + {amount.label}
          </Button>
        ))}
      </div>
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    </Tile>
  );
}

export function DayTiles({
  day,
  unit,
  currentWeightKg,
  onChange,
}: {
  day: DayOverview;
  unit: UnitSystem;
  currentWeightKg: number;
  onChange: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <WaterTile ml={day.water_ml} unit={unit} onAdded={onChange} />
      <Tile title="Sleep">
        {day.sleep_minutes === null ? (
          <Empty>Not logged yet</Empty>
        ) : (
          <Value>{formatDuration(day.sleep_minutes)}</Value>
        )}
      </Tile>
      <Tile title="Steps">
        {day.steps === null ? <Empty>Not logged yet</Empty> : <Value>{formatInt(day.steps)}</Value>}
      </Tile>
      <Tile title="Mood">
        {day.mood === null ? <Empty>Not logged yet</Empty> : <Value>{MOOD_LABELS[day.mood]}</Value>}
      </Tile>
      <Tile title="Weight">
        {day.weight_kg === null ? (
          <Empty>Not weighed today</Empty>
        ) : (
          <Value>{formatWeight(day.weight_kg, unit)}</Value>
        )}
        <Empty>Current: {formatWeight(currentWeightKg, unit)}</Empty>
      </Tile>
    </div>
  );
}
