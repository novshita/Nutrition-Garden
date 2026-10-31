"use client";

import { useState } from "react";
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
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span>
                    {item.quantity} {item.unit} · {item.food_name}
                    <span className="text-muted-foreground">
                      {item.calories === null ? "" : ` · ${formatInt(item.calories)} kcal`}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${item.food_name}`}
                    onClick={() => removeItem(log.id, item.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
