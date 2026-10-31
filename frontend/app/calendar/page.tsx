"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { DaySummary } from "@/components/track/day-summary";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { monthOf, monthRange, monthTitle, shiftMonth, type YearMonth } from "@/lib/calendar";
import type { CalendarDay, DayOverview } from "@/lib/types/api";
import { todayIn } from "@/lib/weight";

function MonthView({
  month,
  today,
  unit,
}: {
  month: YearMonth;
  today: string;
  unit: "METRIC" | "IMPERIAL";
}) {
  const { start, end } = monthRange(month);
  const days = useApi<CalendarDay[]>(`/calendar?start_date=${start}&end_date=${end}`);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useApi<DayOverview>(selected ? `/calendar/${selected}` : null);

  return (
    <div className="flex flex-col gap-6">
      {days.error ? (
        <p className="text-destructive">{days.error.message}</p>
      ) : days.data ? (
        <MonthGrid month={month} days={days.data} today={today} selected={selected} onSelect={setSelected} />
      ) : (
        <p className="text-muted-foreground">Turning the pages…</p>
      )}

      {selected && detail.data?.date === selected && (
        <div key={selected} className="flex flex-col gap-4">
          <DaySummary day={detail.data} unit={unit} />
          <WorkoutCard workout={detail.data.workout} />
          <p className="text-sm text-muted-foreground">
            To add or change something for this day, open the Check-in page and pick this date.
          </p>
        </div>
      )}
      {selected && detail.error && <p className="text-destructive">{detail.error.message}</p>}
    </div>
  );
}

export default function CalendarPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const [month, setMonth] = useState<YearMonth | null>(null);

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

  const { timezone, preferred_unit_system: unit } = profile.data.profile;
  const today = todayIn(timezone);
  const shown = month ?? monthOf(today);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Calendar</h1>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setMonth(shiftMonth(shown, -1))}>
          ← Earlier
        </Button>
        <h2 className="text-lg font-medium" aria-live="polite">
          {monthTitle(shown)}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setMonth(shiftMonth(shown, 1))}>
          Later →
        </Button>
      </div>

      {/* key: each month loads fresh and starts with no day selected. */}
      <MonthView key={`${shown.year}-${shown.month}`} month={shown} today={today} unit={unit} />
    </div>
  );
}
