"use client";

import { AppHeader } from "@/components/app-header";
import { MemoryForm } from "@/components/memory/memory-form";
import { MemoryList } from "@/components/memory/memory-list";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { Memory } from "@/lib/types/api";

export default function MemoriesPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const memories = useApi<Memory[]>(profile.data ? "/memory" : null);

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
      <h1 className="font-diary text-4xl">Memories</h1>
      <p className="text-muted-foreground">
        The fairy only ever knows what you&apos;ve approved here. Nothing is remembered on its own.
      </p>
      {memories.data ? (
        <MemoryList memories={memories.data} onChanged={memories.reload} />
      ) : (
        <p className="text-muted-foreground">{memories.error ? memories.error.message : "Opening the notebook…"}</p>
      )}
      <MemoryForm onAdded={memories.reload} />
    </div>
  );
}
