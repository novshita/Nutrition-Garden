"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { User } from "@/lib/types/api";
import { useApi } from "./use-api";

/** The signed-in user. Sends people to the login page if the session is missing or expired. */
export function useSession() {
  const router = useRouter();
  const { data: user, error, loading } = useApi<User>("/auth/me");

  useEffect(() => {
    if (error?.status === 401) router.replace("/login");
  }, [error, router]);

  const signOut = useCallback(async () => {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  }, [router]);

  return { user, error, loading, signOut };
}
