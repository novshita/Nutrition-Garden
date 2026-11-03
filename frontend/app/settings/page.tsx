"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { ProfileSummary } from "@/lib/types/api";

export default function SettingsPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const [updated, setUpdated] = useState<ProfileSummary | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  // Always edit from the latest saved details.
  const summary = updated ?? profile.data;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Your details</h1>

      {note && (
        <p role="status" className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">
          {note}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Change anything you like. Only what you change is saved, and your calorie goal never changes
            unless you change it yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileSettingsForm
            key={JSON.stringify(summary.profile)}
            summary={summary}
            onSaved={(next, message) => {
              setUpdated(next);
              // The form remounts on a real change, so the confirmation lives here, not in the form.
              setNote(message ? `Saved 🌱 ${message}` : "Saved 🌱");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
