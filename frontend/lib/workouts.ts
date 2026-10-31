/** Workout rules: build the templates, schedule and sessions the API expects. */

import { parseNumber } from "@/lib/onboarding";
import { zonedInstantIso } from "@/lib/track";
import type {
  Difficulty,
  ExerciseCategory,
  ExerciseType,
  ScheduleDay,
  Weekday,
} from "@/lib/types/api";

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  CUSTOM: "Custom",
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  REPS: "Reps",
  TIME: "Timed",
  COMBINED: "Reps and time",
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  UPPER_BODY: "Upper body",
  LOWER_BODY: "Lower body",
  CORE: "Core",
  FULL_BODY: "Full body",
  CARDIO: "Cardio",
  HIIT: "HIIT",
  MOBILITY: "Mobility",
  STRETCHING: "Stretching",
  YOGA: "Yoga",
};

// The same limits the backend enforces. The backend remains the authority.
const LIMITS = { sets: 50, reps: 1000, seconds: 7200, rest: 3600, exercises: 50, session: 360 };

// Templates ---------------------------------------------------------------------------------

export type ExerciseForm = {
  key: string;
  name: string;
  type: ExerciseType;
  category: ExerciseCategory;
  sets: string;
  reps: string;
  seconds: string;
  rest: string;
};

export type TemplateForm = {
  name: string;
  description: string;
  difficulty: Difficulty;
  exercises: ExerciseForm[];
};

export const emptyExercise = (key: string): ExerciseForm => ({
  key,
  name: "",
  type: "REPS",
  category: "FULL_BODY",
  sets: "3",
  reps: "10",
  seconds: "",
  rest: "30",
});

export type ExercisePayload = {
  exercise_name: string;
  exercise_type: ExerciseType;
  category: ExerciseCategory;
  default_sets: number;
  default_reps?: number;
  default_duration_seconds?: number;
  rest_seconds: number;
};

export type TemplatePayload = {
  name: string;
  description?: string;
  difficulty: Difficulty;
  exercises: ExercisePayload[];
};

function wholeNumber(text: string, min: number, max: number): number | null {
  const value = parseNumber(text);
  return value !== null && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function buildTemplatePayload(
  form: TemplateForm,
): { ok: true; payload: TemplatePayload } | { ok: false; error: string } {
  const name = form.name.trim();
  if (!name || name.length > 100) return { ok: false, error: "Please give the workout a name." };
  if (form.description.trim().length > 500) {
    return { ok: false, error: "Please keep the description under 500 characters." };
  }
  if (form.exercises.length === 0) return { ok: false, error: "Add at least one exercise." };
  if (form.exercises.length > LIMITS.exercises) {
    return { ok: false, error: `A workout can have up to ${LIMITS.exercises} exercises.` };
  }

  const exercises: ExercisePayload[] = [];
  for (const [index, exercise] of form.exercises.entries()) {
    const label = exercise.name.trim() || `Exercise ${index + 1}`;
    if (!exercise.name.trim() || exercise.name.trim().length > 100) {
      return { ok: false, error: `Exercise ${index + 1} needs a name.` };
    }
    const sets = wholeNumber(exercise.sets, 1, LIMITS.sets);
    if (sets === null) return { ok: false, error: `${label}: sets should be a whole number from 1 to ${LIMITS.sets}.` };
    const rest = exercise.rest.trim() === "" ? 0 : wholeNumber(exercise.rest, 0, LIMITS.rest);
    if (rest === null) return { ok: false, error: `${label}: rest should be 0 to ${LIMITS.rest} seconds.` };

    const item: ExercisePayload = {
      exercise_name: exercise.name.trim(),
      exercise_type: exercise.type,
      category: exercise.category,
      default_sets: sets,
      rest_seconds: rest,
    };
    // Reps are needed for REPS and COMBINED; time for TIME and COMBINED. Anything else is left out.
    if (exercise.type !== "TIME") {
      const reps = wholeNumber(exercise.reps, 1, LIMITS.reps);
      if (reps === null) return { ok: false, error: `${label}: reps should be a whole number from 1 to ${LIMITS.reps}.` };
      item.default_reps = reps;
    }
    if (exercise.type !== "REPS") {
      const seconds = wholeNumber(exercise.seconds, 1, LIMITS.seconds);
      if (seconds === null) return { ok: false, error: `${label}: time should be 1 to ${LIMITS.seconds} seconds.` };
      item.default_duration_seconds = seconds;
    }
    exercises.push(item);
  }

  const payload: TemplatePayload = { name, difficulty: form.difficulty, exercises };
  if (form.description.trim()) payload.description = form.description.trim();
  return { ok: true, payload };
}

/** "3 × 10 reps", "3 × 30 s", or "3 × 10 reps for 30 s". */
export function describeExercise(exercise: {
  exercise_type: ExerciseType;
  default_sets: number;
  default_reps: number | null;
  default_duration_seconds: number | null;
}): string {
  const { exercise_type: type, default_sets: sets, default_reps: reps, default_duration_seconds: secs } = exercise;
  if (type === "REPS") return `${sets} × ${reps} reps`;
  if (type === "TIME") return `${sets} × ${secs} s`;
  return `${sets} × ${reps} reps for ${secs} s`;
}

// Weekly schedule ---------------------------------------------------------------------------

/** "" nothing planned, "REST" a rest day, otherwise a template id. */
export type ScheduleChoice = "" | "REST" | string;
export type ScheduleSelection = Record<Weekday, ScheduleChoice>;

export const emptySelection = (): ScheduleSelection =>
  Object.fromEntries(WEEKDAYS.map((d) => [d.value, ""])) as ScheduleSelection;

export function selectionFromSchedule(days: ScheduleDay[]): ScheduleSelection {
  const selection = emptySelection();
  for (const day of days) selection[day.weekday] = day.is_rest_day ? "REST" : (day.template_id ?? "");
  return selection;
}

export type ScheduleDayPayload = { weekday: Weekday; is_rest_day: boolean; template_id?: string };

/** The days to send. Days with nothing planned are left out, which clears them. */
export function scheduleToPayload(selection: ScheduleSelection): ScheduleDayPayload[] {
  const days: ScheduleDayPayload[] = [];
  for (const { value } of WEEKDAYS) {
    const choice = selection[value];
    if (choice === "") continue;
    days.push(
      choice === "REST"
        ? { weekday: value, is_rest_day: true }
        : { weekday: value, is_rest_day: false, template_id: choice },
    );
  }
  return days;
}

// Recording a session -----------------------------------------------------------------------

export type SessionPayload = {
  template_id?: string;
  started_at: string;
  completed_at: string;
  notes?: string;
};

export function buildSessionPayload(input: {
  templateId: string;
  date: string;
  startTime: string; // HH:MM
  minutes: string;
  notes: string;
  timeZone: string;
  now?: Date;
}): { ok: true; payload: SessionPayload } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Please choose a day." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    return { ok: false, error: "Please enter when you started." };
  }
  const minutes = wholeNumber(input.minutes, 1, LIMITS.session);
  if (minutes === null) {
    return { ok: false, error: `Please enter how many minutes it took (1 to ${LIMITS.session}).` };
  }
  const notes = input.notes.trim();
  if (notes.length > 500) return { ok: false, error: "Please keep the note under 500 characters." };

  const started = zonedInstantIso(input.date, input.startTime, input.timeZone);
  const completed = new Date(Date.parse(started) + minutes * 60_000);
  const now = input.now ?? new Date();
  if (completed.getTime() > now.getTime() + 5 * 60_000) {
    return { ok: false, error: "That workout would end in the future. Check the day and time." };
  }

  const payload: SessionPayload = { started_at: started, completed_at: completed.toISOString() };
  if (input.templateId) payload.template_id = input.templateId;
  if (notes) payload.notes = notes;
  return { ok: true, payload };
}
