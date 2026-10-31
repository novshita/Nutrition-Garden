"use client";

import { AppHeader } from "@/components/app-header";
import { CaloriesCard } from "@/components/dashboard/calories-card";
import { DayTiles } from "@/components/dashboard/day-tiles";
import { WorkoutCard } from "@/components/dashboard/workout-card";
import { GardenCard } from "@/components/garden/garden-card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { formatLongDate } from "@/lib/format";
import type { DayOverview, Garden } from "@/lib/types/api";

export default function HomePage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  const dashboard = useApi<DayOverview>(ready ? "/dashboard/today" : null);
  const garden = useApi<Garden>(ready ? "/garden" : null);

  if (loading || (!user && error?.status === 401)) {
    return <p className="m-auto text-muted-foreground">Opening your garden…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
  }
  if (profile.error && profile.error.status !== 404) {
    return <p className="m-auto text-destructive">{profile.error.message}</p>;
  }
  if (!profile.data) {
    return <p className="m-auto text-muted-foreground">Opening your garden…</p>;
  }

  const refresh = () => {
    dashboard.reload();
    garden.reload();
  };
  const day = dashboard.data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />

      <div>
        <h1 className="font-diary text-4xl">Hello, {user.display_name}</h1>
        {day && <p className="text-muted-foreground">{formatLongDate(day.date)}</p>}
      </div>

      {garden.data && <GardenCard garden={garden.data} />}

      {day ? (
        <>
          <CaloriesCard day={day} />
          <DayTiles
            day={day}
            unit={profile.data.profile.preferred_unit_system}
            currentWeightKg={profile.data.current_weight_kg}
            onChange={refresh}
          />
          <WorkoutCard workout={day.workout} />
        </>
      ) : (
        <p className="text-muted-foreground">
          {dashboard.error ? dashboard.error.message : "Gathering today…"}
        </p>
      )}
    </div>
  );
}
