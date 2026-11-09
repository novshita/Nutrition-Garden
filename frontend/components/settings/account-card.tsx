"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import {
  buildNameChange,
  buildPasswordChange,
  MAX_NAME_LENGTH,
  type PasswordField,
} from "@/lib/account";
import type { User } from "@/lib/types/api";

const messageOf = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Something went wrong.");

/** Name and password. Separate from the health details: these belong to the sign-in, not the profile. */
export function AccountCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>Signed in as {user.email}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <NameForm initial={user.display_name} />
        <PasswordForm />
      </CardContent>
    </Card>
  );
}

function NameForm({ initial }: { initial: string }) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const result = buildNameChange(text, saved);
    if (result.kind === "error") return setError(result.error);
    if (result.kind === "unchanged") return setMessage("Nothing to change.");
    setBusy(true);
    try {
      const user = await api<User>("/auth/me", { method: "PATCH", body: { display_name: result.displayName } });
      setSaved(user.display_name);
      setText(user.display_name);
      setMessage("Name saved 🌱");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label="What should we call you?" htmlFor={id} error={error ?? undefined}>
        <Input
          id={id}
          autoComplete="given-name"
          maxLength={MAX_NAME_LENGTH}
          value={text}
          onChange={(e) => {
            setMessage(null);
            setText(e.target.value);
          }}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Saving…" : "Save name"}
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </form>
  );
}

const EMPTY = { current: "", next: "", confirm: "" };

function PasswordForm() {
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: PasswordField, value: string) => {
    setMessage(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setMessage(null);
    const result = buildPasswordChange(form);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setBusy(true);
    try {
      await api<void>("/auth/password", { method: "POST", body: result.payload });
      setForm(EMPTY);
      setMessage("Password changed 🔒 Any other devices have been signed out.");
    } catch (caught) {
      setServerError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t pt-6" noValidate aria-label="Change password">
      <p className="text-sm font-medium">Change your password</p>
      <Field label="Current password" htmlFor={id("current")} error={errors.current}>
        <Input
          id={id("current")}
          type="password"
          autoComplete="current-password"
          value={form.current}
          onChange={(e) => set("current", e.target.value)}
        />
      </Field>
      <Field label="New password" htmlFor={id("next")} error={errors.next} hint="At least 8 characters.">
        <Input
          id={id("next")}
          type="password"
          autoComplete="new-password"
          value={form.next}
          onChange={(e) => set("next", e.target.value)}
        />
      </Field>
      <Field label="New password again" htmlFor={id("confirm")} error={errors.confirm}>
        <Input
          id={id("confirm")}
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => set("confirm", e.target.value)}
        />
      </Field>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {serverError}
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Saving…" : "Change password"}
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </form>
  );
}
