"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { WeightPanel } from "@/components/weight/weight-panel";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";

const RANGES = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 365, label: "1 year" },
];

export default function WeightPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const [rangeDays, setRangeDays] = useState(90);

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

  const { preferred_unit_system: unit, timezone, goal_weight_kg: goalKg } = profile.data.profile;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Weight</h1>

      <div className="flex gap-2" role="group" aria-label="Time range">
        {RANGES.map((range) => (
          <Button
            key={range.days}
            type="button"
            size="sm"
            variant={rangeDays === range.days ? "default" : "outline"}
            aria-pressed={rangeDays === range.days}
            onClick={() => setRangeDays(range.days)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      <WeightPanel key={rangeDays} rangeDays={rangeDays} unit={unit} timeZone={timezone} goalKg={goalKg} />
    </div>
  );
}
