"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { MEMORY_CATEGORY_LABELS } from "@/lib/ai";
import type { Memory } from "@/lib/types/api";

/** Pending suggestions to approve or decline, and the memories already approved. */
export function MemoryList({ memories, onChanged }: { memories: Memory[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = memories.filter((m) => m.status === "PENDING");
  const approved = memories.filter((m) => m.status === "APPROVED");

  async function act(id: string, action: "approve" | "reject" | "archive") {
    setBusyId(id);
    setError(null);
    try {
      await api(`/memory/${id}/${action}`, { method: "POST" });
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p role="alert" className="text-sm text-destructive empty:hidden">
        {error}
      </p>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for your OK</CardTitle>
            <CardDescription>The fairy noticed these. Nothing is remembered until you say yes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pending.map((memory) => (
                <li key={memory.id} className="flex flex-col gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
                  <p>
                    “{memory.memory_text}”{" "}
                    <span className="text-xs opacity-70">({MEMORY_CATEGORY_LABELS[memory.category]})</span>
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={busyId === memory.id} onClick={() => act(memory.id, "approve")}>
                      Yes, remember
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busyId === memory.id} onClick={() => act(memory.id, "reject")}>
                      No thanks
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What the fairy remembers</CardTitle>
          <CardDescription>
            {approved.length === 0
              ? "Nothing yet. You can add something below or approve what she suggests."
              : "Only these are ever shared with the fairy. You can let any of them go."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {approved.map((memory) => (
              <li key={memory.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                <span>
                  {memory.memory_text}{" "}
                  <span className="text-xs text-muted-foreground">({MEMORY_CATEGORY_LABELS[memory.category]})</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyId === memory.id}
                  aria-label={`Forget: ${memory.memory_text}`}
                  onClick={() => act(memory.id, "archive")}
                >
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
