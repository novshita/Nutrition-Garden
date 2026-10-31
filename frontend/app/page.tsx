"use client";

import { GardenCard } from "@/components/garden/garden-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import type { Garden } from "@/lib/types/api";

export default function HomePage() {
  const { user, loading, error, signOut } = useSession();
  const garden = useApi<Garden>(user ? "/garden" : null);

  if (loading || (!user && error?.status === 401)) {
    return <p className="m-auto text-muted-foreground">Opening your garden…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
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

      <Card>
        <CardHeader>
          <CardTitle>Let&apos;s get to know you</CardTitle>
          <CardDescription>
            Soon you&apos;ll be able to tell us a little about yourself here and get your personal
            calorie estimate. For now, your garden is ready and waiting.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as {user.email}
        </CardContent>
      </Card>
    </div>
  );
}
