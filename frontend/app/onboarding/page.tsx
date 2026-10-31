"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { OnboardingResult } from "@/components/onboarding/onboarding-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import type { ProfileSummary } from "@/lib/types/api";

export default function OnboardingPage() {
  const router = useRouter();
  const existing = useApi<ProfileSummary>("/profile");
  const [created, setCreated] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    if (existing.error?.status === 401) router.replace("/login");
    else if (existing.data && !created) router.replace("/"); // already set up
  }, [existing.data, existing.error, created, router]);

  const needsOnboarding = existing.error?.status === 404;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-8">
      <p className="font-diary text-3xl text-primary">🌷 Nutrition Garden</p>
      {created ? (
        <OnboardingResult summary={created} onContinue={() => router.replace("/")} />
      ) : needsOnboarding ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-diary text-3xl">Let&apos;s get to know you</CardTitle>
            <CardDescription>
              A few details so we can estimate your daily calories. You can change any of it later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm onDone={setCreated} />
          </CardContent>
        </Card>
      ) : existing.error && existing.error.status !== 401 ? (
        <p className="text-destructive">{existing.error.message}</p>
      ) : (
        <p className="text-muted-foreground">One moment…</p>
      )}
    </main>
  );
}
