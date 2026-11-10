"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { describeTotal, MEAL_LABELS } from "@/lib/food";
import { formatInt } from "@/lib/format";
import type { FoodLog } from "@/lib/types/api";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function FoodLogList({ logs, onChanged }: { logs: FoodLog[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ itemId: string; quantity: string; unit: string } | null>(null);

  async function saveEdit(logId: string) {
    if (!editing) return;
    const quantity = Number(editing.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setError(null);
    try {
      await api(`/food/log/${logId}/items/${editing.itemId}`, {
        method: "PATCH",
        body: { quantity, unit: editing.unit.trim() },
      });
      setEditing(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    }
  }

  async function removeItem(logId: string, itemId: string) {
    setError(null);
    try {
      await api(`/food/log/${logId}/items/${itemId}`, { method: "DELETE" });
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s meals</CardTitle>
        <CardDescription>
          {logs.length === 0 ? "Nothing logged yet today." : "What you've eaten so far."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        {logs.map((log) => (
          <section key={log.id} className="flex flex-col gap-2">
            <h3 className="flex items-baseline justify-between text-sm font-medium">
              <span>
                {MEAL_LABELS[log.meal_type]} · {timeOf(log.consumed_at)}
              </span>
              <span className="text-muted-foreground">
                {describeTotal(log.totals.calories, log.totals.items_missing.calories ?? 0, "kcal")}
              </span>
            </h3>
            <ul className="flex flex-col gap-1">
              {log.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  {editing?.itemId === item.id ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit(log.id);
                      }}
                    >
                      <Input
                        aria-label={`Amount of ${item.food_name}`}
                        className="w-24"
                        inputMode="decimal"
                        value={editing.quantity}
                        onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                      />
                      <Input
                        aria-label={`Unit for ${item.food_name}`}
                        className="w-32"
                        value={editing.unit}
                        onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                      />
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <span>
                      {item.quantity} {item.unit} · {item.food_name}
                      <span className="text-muted-foreground">
                        {item.calories === null ? "" : ` · ${formatInt(item.calories)} kcal`}
                      </span>
                    </span>
                  )}
                  <span className="flex gap-1">
                    {item.food_source !== "CUSTOM" && item.external_food_id !== null && editing?.itemId !== item.id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${item.food_name}`}
                        onClick={() => {
                          setError(null);
                          setEditing({ itemId: item.id, quantity: String(item.quantity), unit: item.unit });
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${item.food_name}`}
                      onClick={() => removeItem(log.id, item.id)}
                    >
                      Remove
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
