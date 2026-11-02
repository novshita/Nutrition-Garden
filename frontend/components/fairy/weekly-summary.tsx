"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { formatShortDate } from "@/lib/format";
import type { WeeklySummary as WeeklySummaryData } from "@/lib/types/api";

export function WeeklySummary() {
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setSummary(await api<WeeklySummaryData>("/ai/weekly-summary", { method: "POST" }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Look back at your week</CardTitle>
        <CardDescription>A little diary reflection on the last seven days.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" onClick={ask} disabled={busy} className="self-start">
          {busy ? "Thinking…" : summary ? "Refresh" : "Look back"}
        </Button>
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        {summary && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {formatShortDate(summary.period_start)} to {formatShortDate(summary.period_end)}
            </p>
            <p className="whitespace-pre-wrap text-sm">{summary.summary}</p>
            {summary.highlights.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {summary.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
