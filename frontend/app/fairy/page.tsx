"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AiUnavailable } from "@/components/fairy/ai-unavailable";
import { ChatPanel } from "@/components/fairy/chat-panel";
import { MealIdeas } from "@/components/fairy/meal-ideas";
import { WeeklySummary } from "@/components/fairy/weekly-summary";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { AiStatus } from "@/lib/types/api";

export default function FairyPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ai = useApi<AiStatus>(profile.data ? "/ai/status" : null);

  if (loading || (!user && error?.status === 401) || (user && !profile.data && !profile.error)) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
  }
  if (profile.error && profile.error.status !== 404) {
    return <p className="m-auto text-destructive">{profile.error.message}</p>;
  }
  if (!profile.data) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Your fairy 🧚</h1>
      <p className="text-muted-foreground">
        She remembers only what you&apos;ve approved on your{" "}
        <Link href="/memories" className="text-primary underline-offset-4 hover:underline">
          memories page
        </Link>
        .
      </p>

      {ai.loading ? (
        <p className="text-muted-foreground">Waking the fairy…</p>
      ) : ai.data?.available ? (
        <>
          <ChatPanel />
          <MealIdeas />
          <WeeklySummary />
        </>
      ) : (
        <AiUnavailable />
      )}
    </div>
  );
}
