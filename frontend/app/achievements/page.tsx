"use client";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { earnedSummary, groupAchievements } from "@/lib/achievements";
import { formatShortDate } from "@/lib/format";
import { describeMilestone } from "@/lib/garden";
import type { Achievement } from "@/lib/types/api";
import { localDate } from "@/lib/weight";

export default function AchievementsPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const achievements = useApi<Achievement[]>(profile.data ? "/garden/achievements" : null);

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

  const timeZone = profile.data.profile.timezone;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Achievements</h1>

      {achievements.data ? (
        <>
          <p className="text-muted-foreground">{earnedSummary(achievements.data)}</p>
          {groupAchievements(achievements.data).map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>Earned ones are yours for good.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li
                      key={`${item.milestone_type}-${item.trigger_value}`}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        item.unlocked ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {item.unlocked ? "🌟 " : "○ "}
                      {describeMilestone(item.milestone_type, item.trigger_value)}
                      {item.unlocked && item.unlocked_at && (
                        <span className="text-xs opacity-70">
                          {" "}
                          · {formatShortDate(localDate(item.unlocked_at, timeZone))}
                        </span>
                      )}
                      {!item.unlocked && <span className="text-xs"> · coming up</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <p className="text-muted-foreground">{achievements.error ? achievements.error.message : "Polishing the trophies…"}</p>
      )}
    </div>
  );
}
