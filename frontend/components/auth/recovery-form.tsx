"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/account";

const backLink = (
  <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
    Back to sign in
  </Link>
);

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-diary text-3xl text-primary">🌷 Nutrition Garden</p>
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>No worries. We&apos;ll email you a link to choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col gap-4 text-center text-sm">
            <p role="status">If that email has an account, a reset link is on its way. It works for an hour.</p>
            <p>{backLink}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
            <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
              {error}
            </p>
            <Button type="submit" disabled={submitting || email.trim() === ""}>
              {submitting ? "One moment…" : "Send me a link"}
            </Button>
            <p className="text-center text-sm">{backLink}</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Please choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, new_password: password } });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-diary text-3xl text-primary">🌷 Nutrition Garden</p>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col gap-4 text-center text-sm">
            <p role="status">Your password is changed. You can sign in with it now.</p>
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : token === "" ? (
          <div className="flex flex-col gap-4 text-center text-sm">
            <p>This link looks incomplete. Please use the link from your email, or ask for a new one.</p>
            <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
              Ask for a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
              {error}
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting ? "One moment…" : "Save new password"}
            </Button>
            <p className="text-center text-sm">
              <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
                Need a new link?
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
