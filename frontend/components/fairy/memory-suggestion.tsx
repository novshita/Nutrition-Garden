"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { MEMORY_CATEGORY_LABELS } from "@/lib/ai";
import type { Memory } from "@/lib/types/api";

/** The fairy noticed something worth remembering. It only counts if the person says yes. */
export function MemorySuggestion({ memory }: { memory: Memory }) {
  const [state, setState] = useState<"asking" | "approved" | "declined">("asking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/${memory.id}/${action}`, { method: "POST" });
      setState(action === "approve" ? "approved" : "declined");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (state !== "asking") {
    return (
      <p className="text-xs text-muted-foreground">
        {state === "approved" ? "🌱 Remembered." : "No problem, I won't remember that."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
      <p>
        Shall I remember this? <span className="font-medium">“{memory.memory_text}”</span>{" "}
        <span className="text-xs opacity-70">({MEMORY_CATEGORY_LABELS[memory.category]})</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => decide("approve")}>
          Yes, remember
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => decide("reject")}>
          Not now
        </Button>
      </div>
      <p role="alert" className="text-xs text-destructive empty:hidden">
        {error}
      </p>
    </div>
  );
}
