import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  buildTemplatePayload,
  describeExercise,
  emptyExercise,
  emptySelection,
  scheduleToPayload,
  selectionFromSchedule,
  type TemplateForm,
} from "@/lib/workouts";
import type { ScheduleDay } from "@/lib/types/api";

const form = (overrides: Partial<TemplateForm> = {}): TemplateForm => ({
  name: "Upper Body",
  description: "",
  difficulty: "BEGINNER",
  exercises: [{ ...emptyExercise("a"), name: "Push-ups" }],
  ...overrides,
});

describe("buildTemplatePayload", () => {
  it("builds a rep-based exercise with no duration", () => {
    expect(buildTemplatePayload(form())).toEqual({
      ok: true,
      payload: {
        name: "Upper Body",
        difficulty: "BEGINNER",
        exercises: [
          {
            exercise_name: "Push-ups",
            exercise_type: "REPS",
            category: "FULL_BODY",
            default_sets: 3,
            default_reps: 10,
            rest_seconds: 30,
          },
        ],
      },
    });
  });

  it("sends only what each exercise type needs", () => {
    const exercises = [
      { ...emptyExercise("a"), name: "Push-ups", type: "REPS" as const, seconds: "99" },
      { ...emptyExercise("b"), name: "Plank", type: "TIME" as const, reps: "99", seconds: "45" },
      { ...emptyExercise("c"), name: "Burpees", type: "COMBINED" as const, reps: "8", seconds: "40" },
    ];
    const result = buildTemplatePayload(form({ exercises }));
    if (!result.ok) throw new Error(result.error);
    const [reps, time, combined] = result.payload.exercises;
    expect("default_duration_seconds" in reps).toBe(false);
    expect("default_reps" in time).toBe(false);
    expect(time.default_duration_seconds).toBe(45);
    expect(combined.default_reps).toBe(8);
    expect(combined.default_duration_seconds).toBe(40);
  });

  it("treats a blank rest as zero and trims text", () => {
    const result = buildTemplatePayload(
      form({ name: "  Legs ", description: " home routine ", exercises: [{ ...emptyExercise("a"), name: " Squats ", rest: "" }] }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.payload.name).toBe("Legs");
    expect(result.payload.description).toBe("home routine");
    expect(result.payload.exercises[0].exercise_name).toBe("Squats");
    expect(result.payload.exercises[0].rest_seconds).toBe(0);
  });

  it("requires a name and at least one named exercise", () => {
    expect(buildTemplatePayload(form({ name: " " })).ok).toBe(false);
    expect(buildTemplatePayload(form({ exercises: [] })).ok).toBe(false);
    expect(buildTemplatePayload(form({ exercises: [emptyExercise("a")] })).ok).toBe(false);
  });

  it.each([
    ["sets", "0"],
    ["sets", "51"],
    ["sets", "2.5"],
    ["reps", "0"],
    ["reps", "1001"],
    ["reps", "abc"],
    ["rest", "-1"],
    ["rest", "3601"],
  ])("rejects %s = %s", (field, value) => {
    const exercises = [{ ...emptyExercise("a"), name: "Push-ups", [field]: value }];
    expect(buildTemplatePayload(form({ exercises })).ok).toBe(false);
  });

  it("requires a time for timed and combined exercises", () => {
    for (const type of ["TIME", "COMBINED"] as const) {
      const exercises = [{ ...emptyExercise("a"), name: "Plank", type, seconds: "" }];
      const result = buildTemplatePayload(form({ exercises }));
      expect(!result.ok && result.error).toContain("time");
    }
    const tooLong = [{ ...emptyExercise("a"), name: "Plank", type: "TIME" as const, seconds: "7201" }];
    expect(buildTemplatePayload(form({ exercises: tooLong })).ok).toBe(false);
  });

  it("names the exercise that has the problem", () => {
    const exercises = [
      { ...emptyExercise("a"), name: "Push-ups" },
      { ...emptyExercise("b"), name: "Squats", sets: "0" },
    ];
    const result = buildTemplatePayload(form({ exercises }));
    expect(!result.ok && result.error).toContain("Squats");
  });
});

describe("describeExercise", () => {
  it("summarises each type", () => {
    const base = { default_sets: 3, default_reps: null, default_duration_seconds: null };
    expect(describeExercise({ ...base, exercise_type: "REPS", default_reps: 12 })).toBe("3 × 12 reps");
    expect(describeExercise({ ...base, exercise_type: "TIME", default_duration_seconds: 30 })).toBe("3 × 30 s");
    expect(
      describeExercise({ ...base, exercise_type: "COMBINED", default_reps: 8, default_duration_seconds: 40 }),
    ).toBe("3 × 8 reps for 40 s");
  });
});

describe("schedule", () => {
  const days: ScheduleDay[] = [
    { weekday: "MONDAY", is_rest_day: false, template_id: "t-upper", template_name: "Upper Body" },
    { weekday: "WEDNESDAY", is_rest_day: true, template_id: null, template_name: null },
  ];

  it("reads the saved schedule into the form", () => {
    const selection = selectionFromSchedule(days);
    expect(selection.MONDAY).toBe("t-upper");
    expect(selection.WEDNESDAY).toBe("REST");
    expect(selection.TUESDAY).toBe("");
  });

  it("sends planned and rest days, leaving blank days out so they're cleared", () => {
    const selection = { ...emptySelection(), MONDAY: "t-upper", TUESDAY: "t-upper", WEDNESDAY: "REST" };
    expect(scheduleToPayload(selection)).toEqual([
      { weekday: "MONDAY", is_rest_day: false, template_id: "t-upper" },
      { weekday: "TUESDAY", is_rest_day: false, template_id: "t-upper" },
      { weekday: "WEDNESDAY", is_rest_day: true },
    ]);
  });

  it("round-trips: what is saved comes back the same", () => {
    const selection = selectionFromSchedule(days);
    const payload = scheduleToPayload(selection);
    expect(payload.map((d) => d.weekday)).toEqual(["MONDAY", "WEDNESDAY"]);
    expect(scheduleToPayload(emptySelection())).toEqual([]);
  });

  it("keeps the week in Monday-first order", () => {
    const payload = scheduleToPayload({ ...emptySelection(), SUNDAY: "REST", MONDAY: "REST" });
    expect(payload.map((d) => d.weekday)).toEqual(["MONDAY", "SUNDAY"]);
  });
});

describe("buildSessionPayload", () => {
  const base = {
    templateId: "t-upper",
    date: "2026-03-10",
    startTime: "08:00",
    minutes: "45",
    notes: "",
    timeZone: "Asia/Kolkata",
    now: new Date("2026-03-11T00:00:00Z"),
  };

  it("works out the start and end in the user's time zone", () => {
    expect(buildSessionPayload(base)).toEqual({
      ok: true,
      payload: {
        template_id: "t-upper",
        started_at: "2026-03-10T02:30:00.000Z", // 08:00 in India
        completed_at: "2026-03-10T03:15:00.000Z",
      },
    });
  });

  it("allows a workout with no template and includes a trimmed note", () => {
    const result = buildSessionPayload({ ...base, templateId: "", notes: " felt strong " });
    if (!result.ok) throw new Error(result.error);
    expect("template_id" in result.payload).toBe(false);
    expect(result.payload.notes).toBe("felt strong");
  });

  it("rejects a workout that would end in the future, with a few minutes of allowance", () => {
    // 08:00 start + 45 min in India ends at 03:15Z.
    const tooEarly = new Date("2026-03-10T03:00:00Z"); // ends 15 minutes from now
    expect(buildSessionPayload({ ...base, now: tooEarly }).ok).toBe(false);
    const justAbout = new Date("2026-03-10T03:12:00Z"); // ends 3 minutes from now
    expect(buildSessionPayload({ ...base, now: justAbout }).ok).toBe(true);
  });

  it.each([
    ["", "08:00", "45"],
    ["2026-03-10", "", "45"],
    ["2026-03-10", "25:00", "45"],
    ["2026-03-10", "08:00", "0"],
    ["2026-03-10", "08:00", "361"],
    ["2026-03-10", "08:00", "abc"],
    ["2026-03-10", "08:00", "30.5"],
  ])("rejects date %j, start %j, minutes %j", (date, startTime, minutes) => {
    expect(buildSessionPayload({ ...base, date, startTime, minutes }).ok).toBe(false);
  });
});
