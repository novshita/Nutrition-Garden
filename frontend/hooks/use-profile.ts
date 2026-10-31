"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ProfileSummary } from "@/lib/types/api";
import { useApi } from "./use-api";

/** The profile summary. Sends people who haven't done onboarding to the onboarding page. */
export function useProfile(enabled: boolean) {
  const router = useRouter();
  const profile = useApi<ProfileSummary>(enabled ? "/profile" : null);

  useEffect(() => {
    if (profile.error?.status === 404) router.replace("/onboarding");
  }, [profile.error, router]);

  return profile;
}
