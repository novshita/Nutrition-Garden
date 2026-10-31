"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { DaySummary } from "@/components/track/day-summary";
import { MoodSection } from "@/components/track/mood-section";
import { SleepSection } from "@/components/track/sleep-section";
import { StepsSection } from "@/components/track/steps-section";
import { WaterSection } from "@/components/track/water-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { DayOverview } from "@/lib/types/api";

export default function TrackPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  // The backend decides what "today" is (in the user's time zone).
  const today = useApi<DayOverview>(ready ? "/dashboard/today" : null);
  const [selected, setSelected] = useState<string | null>(null);

  const todayDate = today.data?.date ?? null;
  const date = selected ?? todayDate;
  const overview = useApi<DayOverview>(date ? `/calendar/${date}` : null);

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

  const { preferred_unit_system: unit, timezone } = profile.data.profile;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Daily check-in</h1>

      {date && todayDate ? (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="track-date">Day</Label>
            <Input
              id="track-date"
              type="date"
              className="w-48"
              value={date}
              max={todayDate}
              onChange={(e) => e.target.value && setSelected(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Forgot to log something? Pick an earlier day and fill it in.
            </p>
          </div>

          {/* key={date}: switching day gives every section a fresh load of that day's data. */}
          <WaterSection
            key={`water-${date}`}
            date={date}
            isToday={date === todayDate}
            unit={unit}
            timeZone={timezone}
            onChanged={overview.reload}
          />
          <SleepSection key={`sleep-${date}`} date={date} timeZone={timezone} onChanged={overview.reload} />
          <MoodSection key={`mood-${date}`} date={date} onChanged={overview.reload} />
          <StepsSection key={`steps-${date}`} date={date} onChanged={overview.reload} />

          {overview.data?.date === date && <DaySummary day={overview.data} unit={unit} />}
        </>
      ) : (
        <p className="text-muted-foreground">{today.error ? today.error.message : "Gathering the day…"}</p>
      )}
    </div>
  );
}
