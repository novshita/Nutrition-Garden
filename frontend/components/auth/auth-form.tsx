"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { User } from "@/lib/types/api";

const MIN_PASSWORD_LENGTH = 8;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Please choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await api<User>(isRegister ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: isRegister
          ? { email, password, display_name: displayName.trim() }
          : { email, password },
      });
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-diary text-3xl text-primary">🌷 Nutrition Garden</p>
        <CardTitle className="text-xl">{isRegister ? "Plant your garden" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isRegister
            ? "A little food diary that wants to see you thrive."
            : "Your garden has been waiting for you."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {isRegister && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="display_name">What should we call you?</Label>
              <Input
                id="display_name"
                autoComplete="given-name"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isRegister && (
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            )}
          </div>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? "One moment…" : isRegister ? "Create my garden" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? "Already have a garden? " : "New here? "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
