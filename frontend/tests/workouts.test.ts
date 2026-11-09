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

// ---- Editing, per-set logging ----

import {
  addSetRow,
  buildSetPayloads,
  formFromTemplate,
  setRowsForTemplate,
  summarizeSets,
} from "@/lib/workouts";
import type { WorkoutSet, WorkoutTemplate } from "@/lib/types/api";

const template: WorkoutTemplate = {
  id: "t1",
  name: "Upper Body",
  description: null,
  difficulty: "BEGINNER",
  exercises: [
    {
      id: "e1",
      exercise_name: "Push-ups",
      exercise_type: "REPS",
      category: "UPPER_BODY",
      order_index: 0,
      default_sets: 3,
      default_reps: 12,
      default_duration_seconds: null,
      rest_seconds: 45,
    },
    {
      id: "e2",
      exercise_name: "Plank",
      exercise_type: "TIME",
      category: "CORE",
      order_index: 1,
      default_sets: 2,
      default_reps: null,
      default_duration_seconds: 30,
      rest_seconds: 30,
    },
  ],
};

describe("editing a workout", () => {
  it("fills the form from the saved workout, keeping exercise ids", () => {
    const form = formFromTemplate(template);
    expect(form.name).toBe("Upper Body");
    expect(form.description).toBe("");
    expect(form.exercises.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(form.exercises[1]).toMatchObject({ type: "TIME", seconds: "30", reps: "", sets: "2", rest: "30" });
  });

  it("sends the ids back so existing exercises keep their history", () => {
    const result = buildTemplatePayload(formFromTemplate(template));
    if (!result.ok) throw new Error(result.error);
    expect(result.payload.exercises.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(result.payload.exercises[1]).not.toHaveProperty("default_reps");
  });

  it("leaves the id out for a new exercise", () => {
    const form = formFromTemplate(template);
    form.exercises.push({ ...emptyExercise("new"), name: "Squats" });
    const result = buildTemplatePayload(form);
    if (!result.ok) throw new Error(result.error);
    expect(result.payload.exercises[2]).not.toHaveProperty("id");
  });

  it("still checks the edited values", () => {
    const form = formFromTemplate(template);
    form.exercises[0].reps = "0";
    expect(buildTemplatePayload(form).ok).toBe(false);
    form.exercises[0].reps = "12";
    form.name = "   ";
    expect(buildTemplatePayload(form).ok).toBe(false);
  });
});

describe("per-set rows", () => {
  it("makes one unticked row per planned set, starting from the plan's numbers", () => {
    const rows = setRowsForTemplate(template);
    expect(rows.map((r) => [r.exerciseName, r.setNumber, r.done])).toEqual([
      ["Push-ups", 1, false],
      ["Push-ups", 2, false],
      ["Push-ups", 3, false],
      ["Plank", 1, false],
      ["Plank", 2, false],
    ]);
    expect(rows[0].reps).toBe("12");
    expect(rows[3]).toMatchObject({ reps: "", seconds: "30" });
  });

  it("adds a set after the exercise's last one, copying its numbers", () => {
    const rows = setRowsForTemplate(template);
    rows[2].reps = "9";
    const more = addSetRow(rows, template, "e1");
    if (!more) throw new Error("expected a row");
    expect(more.map((r) => `${r.exerciseName}${r.setNumber}`)).toEqual([
      "Push-ups1",
      "Push-ups2",
      "Push-ups3",
      "Push-ups4",
      "Plank1",
      "Plank2",
    ]);
    expect(more[3].reps).toBe("9");
    expect(more[3].done).toBe(false);
  });

  it("stops adding sets at 100", () => {
    let rows = setRowsForTemplate(template);
    rows = rows.map((r) => (r.key === "e1-3" ? { ...r, setNumber: 100 } : r));
    expect(addSetRow(rows, template, "e1")).toBeNull();
  });
});

describe("buildSetPayloads", () => {
  it("records only the ticked sets", () => {
    const rows = setRowsForTemplate(template);
    rows[0].done = true;
    rows[1].done = true;
    rows[1].reps = "10";
    const result = buildSetPayloads(rows);
    expect(result).toEqual({
      ok: true,
      sets: [
        { exercise_id: "e1", set_number: 1, repetitions: 12, completed: true },
        { exercise_id: "e1", set_number: 2, repetitions: 10, completed: true },
      ],
    });
  });

  it("sends nothing for a workout where no set was ticked", () => {
    expect(buildSetPayloads(setRowsForTemplate(template))).toEqual({ ok: true, sets: [] });
  });

  it("treats a blank number as not recorded, never zero", () => {
    const rows = setRowsForTemplate(template);
    rows[0].done = true;
    rows[0].reps = "  ";
    const result = buildSetPayloads(rows);
    if (!result.ok) throw new Error(result.error);
    expect(result.sets[0]).not.toHaveProperty("repetitions");
  });

  it("keeps only the numbers that fit the exercise type", () => {
    const rows = setRowsForTemplate(template);
    rows[0].seconds = "99"; // reps exercise: seconds ignored
    rows[0].done = true;
    rows[3].reps = "50"; // timed exercise: reps ignored
    rows[3].done = true;
    const result = buildSetPayloads(rows);
    if (!result.ok) throw new Error(result.error);
    expect(result.sets[0]).toEqual({ exercise_id: "e1", set_number: 1, repetitions: 12, completed: true });
    expect(result.sets[1]).toEqual({ exercise_id: "e2", set_number: 1, duration_seconds: 30, completed: true });
  });

  it("allows zero reps but refuses nonsense, naming the set", () => {
    const rows = setRowsForTemplate(template);
    rows[0].done = true;
    rows[0].reps = "0";
    expect(buildSetPayloads(rows).ok).toBe(true);
    for (const bad of ["abc", "-1", "1.5", "1001"]) {
      rows[0].reps = bad;
      const result = buildSetPayloads(rows);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Push-ups, set 1");
    }
    rows[0].reps = "10";
    rows[3].done = true;
    rows[3].seconds = "7201";
    expect(buildSetPayloads(rows).ok).toBe(false);
  });

  it("ignores a bad number on a set that wasn't ticked", () => {
    const rows = setRowsForTemplate(template);
    rows[0].reps = "abc";
    expect(buildSetPayloads(rows)).toEqual({ ok: true, sets: [] });
  });
});

describe("sessions with sets", () => {
  const base = {
    templateId: "t1",
    date: "2026-03-10",
    startTime: "08:00",
    minutes: "30",
    notes: "",
    timeZone: "UTC",
    now: new Date("2026-03-11T00:00:00Z"),
  };

  it("includes sets only when there are some", () => {
    const sets = [{ exercise_id: "e1", set_number: 1, repetitions: 12, completed: true as const }];
    const withSets = buildSessionPayload({ ...base, sets });
    if (!withSets.ok) throw new Error(withSets.error);
    expect(withSets.payload.sets).toEqual(sets);
    const without = buildSessionPayload({ ...base, sets: [] });
    if (!without.ok) throw new Error(without.error);
    expect(without.payload).not.toHaveProperty("sets");
  });
});

describe("summarizeSets", () => {
  const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
    exercise_id: "e1",
    exercise_name: "Push-ups",
    set_number: 1,
    repetitions: null,
    duration_seconds: null,
    completed: true,
    ...over,
  });

  it("groups by exercise and lists the numbers", () => {
    expect(
      summarizeSets([
        set({ set_number: 1, repetitions: 12 }),
        set({ set_number: 2, repetitions: 10 }),
        set({ exercise_name: "Plank", set_number: 1, duration_seconds: 30 }),
      ]),
    ).toEqual(["Push-ups: 2 sets (12, 10 reps)", "Plank: 1 set (30 s)"]);
  });

  it("counts a set with no numbers and skips sets that weren't completed", () => {
    expect(
      summarizeSets([set({}), set({ set_number: 2, completed: false, repetitions: 5 })]),
    ).toEqual(["Push-ups: 1 set"]);
  });

  it("still reads well when the exercise was removed", () => {
    expect(summarizeSets([set({ exercise_id: null, exercise_name: null, repetitions: 8 })])).toEqual([
      "Exercise: 1 set (8 reps)",
    ]);
  });

  it("is empty with no sets", () => {
    expect(summarizeSets([])).toEqual([]);
  });
});
