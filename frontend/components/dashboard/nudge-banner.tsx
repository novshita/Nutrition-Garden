"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { dismissNudge, rememberNudge, savedNudge, shouldAsk } from "@/lib/nudge";
import type { Nudge } from "@/lib/types/api";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage is fine; the reminder just won't be kept across reloads
  }
}

/**
 * The gentle evening reminder. The backend hands it out at most once a day; it's kept here until the
 * person dismisses it. Only mount this on the client, after the page has loaded.
 */
export function NudgeBanner({ today }: { today: string }) {
  const [message, setMessage] = useState<string | null>(() => {
    const store = storage();
    return store ? savedNudge(store, today) : null;
  });

  useEffect(() => {
    const store = storage();
    if (store && !shouldAsk(store, today)) return;
    let cancelled = false;
    api<Nudge>("/ai/nudge")
      .then((nudge) => {
        if (cancelled || !nudge.show || !nudge.message) return;
        if (store) rememberNudge(store, today, nudge.message);
        setMessage(nudge.message);
      })
      .catch(() => {
        // A reminder is a nicety: if it can't be fetched, say nothing.
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  if (!message) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-accent p-4 text-accent-foreground">
      <p className="text-sm">🧚 {message}</p>
      <div className="flex gap-2">
        <Link href="/fairy" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Meal ideas
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const store = storage();
            if (store) dismissNudge(store, today);
            setMessage(null);
          }}
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
