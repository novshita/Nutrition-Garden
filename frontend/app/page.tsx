"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GardenCard } from "@/components/garden/garden-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import type { Garden, ProfileSummary } from "@/lib/types/api";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, error, signOut } = useSession();
  const garden = useApi<Garden>(user ? "/garden" : null);
  const profile = useApi<ProfileSummary>(user ? "/profile" : null);

  useEffect(() => {
    if (profile.error?.status === 404) router.replace("/onboarding"); // not set up yet
  }, [profile.error, router]);

  if (loading || (!user && error?.status === 401)) {
    return <p className="m-auto text-muted-foreground">Opening your garden…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
  }
  if (profile.loading || profile.error?.status === 404) {
    return <p className="m-auto text-muted-foreground">Opening your garden…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <p className="font-diary text-3xl text-primary">🌷 Nutrition Garden</p>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <h1 className="font-diary text-4xl">Hello, {user.display_name}</h1>

      {garden.data ? (
        <GardenCard garden={garden.data} />
      ) : (
        <p className="text-muted-foreground">
          {garden.error ? garden.error.message : "Watering the garden…"}
        </p>
      )}

      {profile.data && (
        <Card>
          <CardHeader>
            <CardTitle>Your daily estimate</CardTitle>
            <CardDescription>
              About {profile.data.calorie_target_kcal} kcal a day for gradual gain, an estimate and
              not medical advice.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Current weight {profile.data.current_weight_kg} kg · BMI {profile.data.bmi.toFixed(1)} ·
            signed in as {user.email}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
