"use client";

import { AppHeader } from "@/components/app-header";
import { SuggestionCard } from "@/components/goals/suggestion-card";
import { TargetForm } from "@/components/goals/target-form";
import { TargetHistory } from "@/components/goals/target-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { formatInt } from "@/lib/format";
import type { CalorieSuggestion, CalorieTargetHistory } from "@/lib/types/api";

export default function GoalsPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  const targets = useApi<CalorieTargetHistory>(ready ? "/goals/calorie-target" : null);
  const suggestion = useApi<CalorieSuggestion>(ready ? "/goals/calorie-target/suggestion" : null);

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

  const refresh = () => {
    targets.reload();
    suggestion.reload();
    profile.reload();
  };
  const current = targets.data?.current ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Calorie goal</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{current ? `${formatInt(current.target_kcal)} kcal` : "—"}</CardTitle>
          <CardDescription>Your daily estimate for gradual weight gain</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Your body uses roughly {formatInt(profile.data.tdee_kcal)} kcal a day (about{" "}
            {formatInt(profile.data.bmr_kcal)} at rest). This goal is an estimate, not medical advice.
            It never changes unless you decide it should.
          </p>
        </CardContent>
      </Card>

      {suggestion.data && <SuggestionCard key={suggestion.data.current_target_kcal} suggestion={suggestion.data} onAccepted={refresh} />}
      {suggestion.error && <p className="text-destructive">{suggestion.error.message}</p>}

      <TargetForm onSaved={refresh} />

      {targets.data && (
        <TargetHistory history={targets.data.history} timeZone={profile.data.profile.timezone} />
      )}
      {targets.error && <p className="text-destructive">{targets.error.message}</p>}
    </div>
  );
}
