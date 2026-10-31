"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import {
  buildProfilePayload,
  convertFormUnits,
  emptyForm,
  type FieldKey,
  type OnboardingForm as FormState,
} from "@/lib/onboarding";
import type { ActivityLevel, ProfileSummary, UnitSystem } from "@/lib/types/api";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "SEDENTARY", label: "Mostly sitting: little or no exercise" },
  { value: "LIGHT", label: "Light: exercise 1–3 days a week" },
  { value: "MODERATE", label: "Moderate: exercise 3–5 days a week" },
  { value: "VERY_ACTIVE", label: "Very active: hard exercise 6–7 days a week" },
  { value: "EXTRA_ACTIVE", label: "Extra active: very hard exercise or a physical job" },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function timezoneChoices(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function OnboardingForm({ onDone }: { onDone: (summary: ProfileSummary) => void }) {
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;
  const [form, setForm] = useState<FormState>(() => emptyForm(detectTimezone()));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timezones = useMemo(() => timezoneChoices(), []);
  const metric = form.unitSystem === "METRIC";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const switchUnits = (to: UnitSystem) => setForm((current) => convertFormUnits(current, to));
  const aria = (field: FieldKey, name: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${id(name)}-error` } : {};

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const result = buildProfilePayload(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      onDone(await api<ProfileSummary>("/profile", { method: "POST", body: result.payload }));
    } catch (caught) {
      setServerError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Units</span>
        <div className="flex gap-2" role="group" aria-label="Units">
          {(["METRIC", "IMPERIAL"] as const).map((system) => (
            <Button
              key={system}
              type="button"
              variant={form.unitSystem === system ? "default" : "outline"}
              aria-pressed={form.unitSystem === system}
              onClick={() => switchUnits(system)}
            >
              {system === "METRIC" ? "Metric (kg, cm)" : "Imperial (lb, ft/in)"}
            </Button>
          ))}
        </div>
      </div>

      <Field label="Date of birth" htmlFor={id("dob")} error={errors.dateOfBirth}>
        <Input
          id={id("dob")}
          type="date"
          value={form.dateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => set("dateOfBirth", e.target.value)}
          {...aria("dateOfBirth", "dob")}
        />
      </Field>

      <Field
        label="Sex"
        htmlFor={id("sex")}
        error={errors.sex}
        hint="Used only for the calorie estimate."
      >
        <NativeSelect
          id={id("sex")}
          value={form.sex}
          onChange={(e) => set("sex", e.target.value as FormState["sex"])}
          {...aria("sex", "sex")}
        >
          <option value="">Choose…</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </NativeSelect>
      </Field>

      {metric ? (
        <Field label="Height (cm)" htmlFor={id("height")} error={errors.height}>
          <Input
            id={id("height")}
            inputMode="decimal"
            value={form.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
            {...aria("height", "height")}
          />
        </Field>
      ) : (
        <Field label="Height" htmlFor={id("height")} error={errors.height}>
          <div className="flex items-center gap-2">
            <Input
              id={id("height")}
              inputMode="numeric"
              aria-label="Feet"
              value={form.heightFt}
              onChange={(e) => set("heightFt", e.target.value)}
              {...aria("height", "height")}
            />
            <span className="text-sm text-muted-foreground">ft</span>
            <Input
              inputMode="decimal"
              aria-label="Inches"
              value={form.heightIn}
              onChange={(e) => set("heightIn", e.target.value)}
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </Field>
      )}

      <Field label={`Current weight (${metric ? "kg" : "lb"})`} htmlFor={id("weight")} error={errors.weight}>
        <Input
          id={id("weight")}
          inputMode="decimal"
          value={form.weight}
          onChange={(e) => set("weight", e.target.value)}
          {...aria("weight", "weight")}
        />
      </Field>

      <Field
        label={`Goal weight (${metric ? "kg" : "lb"})`}
        htmlFor={id("goal")}
        error={errors.goalWeight}
        hint="Gradual, sustainable gain is the aim, so there's no rush."
      >
        <Input
          id={id("goal")}
          inputMode="decimal"
          value={form.goalWeight}
          onChange={(e) => set("goalWeight", e.target.value)}
          {...aria("goalWeight", "goal")}
        />
      </Field>

      <Field label="Usual activity level" htmlFor={id("activity")} error={errors.activityLevel}>
        <NativeSelect
          id={id("activity")}
          value={form.activityLevel}
          onChange={(e) => set("activityLevel", e.target.value as FormState["activityLevel"])}
          {...aria("activityLevel", "activity")}
        >
          <option value="">Choose…</option>
          {ACTIVITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field
        label="Time zone"
        htmlFor={id("tz")}
        error={errors.timezone}
        hint="Detected from your device. Your days start and end in this time zone."
      >
        <Input
          id={id("tz")}
          list={id("tz-list")}
          value={form.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          {...aria("timezone", "tz")}
        />
        <datalist id={id("tz-list")}>
          {timezones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </Field>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {serverError}
      </p>
      <Button type="submit" disabled={submitting}>
        {submitting ? "One moment…" : "Plant my garden"}
      </Button>
    </form>
  );
}
