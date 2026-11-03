"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import { formatWeight } from "@/lib/format";
import { type FieldKey, type OnboardingForm } from "@/lib/onboarding";
import {
  buildProfileChanges,
  describeEstimateChange,
  formFromProfile,
  switchUnits,
  untouched,
  type Touched,
} from "@/lib/settings";
import type { ActivityLevel, ProfileSummary, UnitSystem } from "@/lib/types/api";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "SEDENTARY", label: "Mostly sitting: little or no exercise" },
  { value: "LIGHT", label: "Light: exercise 1–3 days a week" },
  { value: "MODERATE", label: "Moderate: exercise 3–5 days a week" },
  { value: "VERY_ACTIVE", label: "Very active: hard exercise 6–7 days a week" },
  { value: "EXTRA_ACTIVE", label: "Extra active: very hard exercise or a physical job" },
];

function timezoneChoices(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** Edit the details from onboarding. Only what you change is saved, and your calorie goal stays put. */
export function ProfileSettingsForm({
  summary,
  onSaved,
}: {
  summary: ProfileSummary;
  onSaved: (updated: ProfileSummary, note: string | null) => void;
}) {
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;
  const [form, setForm] = useState<OnboardingForm>(() => formFromProfile(summary));
  const [touched, setTouched] = useState<Touched>(untouched());
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timezones = useMemo(() => timezoneChoices(), []);
  const metric = form.unitSystem === "METRIC";
  const unit = summary.profile.preferred_unit_system;

  const set = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setMessage(null);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const edit = (field: keyof Touched) => setTouched((current) => ({ ...current, [field]: true }));
  const aria = (field: FieldKey, name: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${id(name)}-error` } : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setMessage(null);
    const result = buildProfileChanges(form, summary, touched);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (Object.keys(result.changes).length === 0) {
      setMessage("Nothing to change. Everything is as you left it.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api<ProfileSummary>("/profile", { method: "PATCH", body: result.changes });
      setTouched(untouched());
      setForm(formFromProfile(updated));
      setMessage("Saved 🌱");
      onSaved(updated, describeEstimateChange(summary, updated));
    } catch (caught) {
      setServerError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const timezoneChanged = form.timezone.trim() !== summary.profile.timezone;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Units</span>
        <div className="flex gap-2" role="group" aria-label="Units">
          {(["METRIC", "IMPERIAL"] as UnitSystem[]).map((system) => (
            <Button
              key={system}
              type="button"
              variant={form.unitSystem === system ? "default" : "outline"}
              aria-pressed={form.unitSystem === system}
              onClick={() => setForm((current) => switchUnits(current, summary, touched, system))}
            >
              {system === "METRIC" ? "Metric (kg, cm)" : "Imperial (lb, ft/in)"}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          This only changes how numbers are shown. Nothing you&apos;ve logged is altered.
        </p>
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

      <Field label="Sex" htmlFor={id("sex")} error={errors.sex} hint="Used only for the calorie estimate.">
        <NativeSelect id={id("sex")} value={form.sex} onChange={(e) => set("sex", e.target.value as OnboardingForm["sex"])} {...aria("sex", "sex")}>
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
            onChange={(e) => {
              edit("height");
              set("heightCm", e.target.value);
            }}
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
              onChange={(e) => {
                edit("height");
                set("heightFt", e.target.value);
              }}
              {...aria("height", "height")}
            />
            <span className="text-sm text-muted-foreground">ft</span>
            <Input
              inputMode="decimal"
              aria-label="Inches"
              value={form.heightIn}
              onChange={(e) => {
                edit("height");
                set("heightIn", e.target.value);
              }}
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </Field>
      )}

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
          onChange={(e) => {
            edit("goalWeight");
            set("goalWeight", e.target.value);
          }}
          {...aria("goalWeight", "goal")}
        />
      </Field>

      <p className="text-sm text-muted-foreground">
        Current weight: {formatWeight(summary.current_weight_kg, unit)}. Change it by logging a weigh-in on the{" "}
        <Link href="/weight" className="text-primary underline-offset-4 hover:underline">
          Weight page
        </Link>
        .
      </p>

      <Field label="Usual activity level" htmlFor={id("activity")} error={errors.activityLevel}>
        <NativeSelect
          id={id("activity")}
          value={form.activityLevel}
          onChange={(e) => set("activityLevel", e.target.value as OnboardingForm["activityLevel"])}
          {...aria("activityLevel", "activity")}
        >
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
        hint={
          timezoneChanged
            ? "Your days will start and end in this time zone from now on. Things you've already logged keep their exact time, so some may land on a different day."
            : "Your days start and end in this time zone."
        }
      >
        <Input id={id("tz")} list={id("tz-list")} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} {...aria("timezone", "tz")} />
        <datalist id={id("tz-list")}>
          {timezones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </Field>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {serverError}
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </form>
  );
}
