import { describe, expect, it } from "vitest";
import { countEarned, earnedSummary, groupAchievements } from "@/lib/achievements";
import type { Achievement, MilestoneType } from "@/lib/types/api";

const a = (milestone_type: MilestoneType, trigger_value: number, unlocked = false): Achievement => ({
  milestone_type,
  trigger_value,
  unlocked,
  unlocked_at: unlocked ? "2026-03-10T10:00:00Z" : null,
});

const LIST: Achievement[] = [
  a("FIRST_LOG", 1, true),
  a("FIRST_WORKOUT", 1),
  a("FIRST_WEEK", 7, true),
  a("CONSISTENT_TRACKING", 14),
  a("WORKOUT_STREAK", 3),
  a("WORKOUT_STREAK", 7),
  a("HYDRATION_MILESTONE", 7),
  a("WEIGHT_MILESTONE", 25),
  a("GARDEN_STAGE", 2),
];

describe("groupAchievements", () => {
  it("groups related achievements, keeping the order they came in", () => {
    const groups = groupAchievements(LIST);
    expect(groups.map((g) => g.title)).toEqual([
      "First steps",
      "Showing up",
      "Moving",
      "Hydration",
      "Toward your goal",
      "Your garden",
    ]);
    expect(groups[0].items.map((i) => i.milestone_type)).toEqual(["FIRST_LOG", "FIRST_WORKOUT", "FIRST_WEEK"]);
    expect(groups[2].items.map((i) => i.trigger_value)).toEqual([3, 7]);
  });

  it("keeps every achievement exactly once", () => {
    const flat = groupAchievements(LIST).flatMap((g) => g.items);
    expect(flat).toHaveLength(LIST.length);
    expect(new Set(flat).size).toBe(LIST.length);
  });

  it("handles an empty list", () => {
    expect(groupAchievements([])).toEqual([]);
  });
});

describe("counting and wording", () => {
  it("counts what's earned and what's ahead", () => {
    expect(countEarned(LIST)).toEqual({ earned: 2, ahead: 7 });
    expect(countEarned([])).toEqual({ earned: 0, ahead: 0 });
  });

  it("speaks warmly in every situation", () => {
    expect(earnedSummary(LIST.map((x) => ({ ...x, unlocked: false, unlocked_at: null })))).toContain("waiting");
    expect(earnedSummary(LIST)).toBe("You've earned 2 achievements, with 7 more to look forward to. 🌟");
    expect(earnedSummary([a("FIRST_LOG", 1, true), a("FIRST_WEEK", 7)])).toContain("1 achievement,");
    expect(earnedSummary(LIST.map((x) => ({ ...x, unlocked: true })))).toBe("You've earned all 9 achievements. 🌟");
  });

  it("never uses negative framing", () => {
    for (const list of [LIST, [], LIST.map((x) => ({ ...x, unlocked: false }))]) {
      expect(earnedSummary(list)).not.toMatch(/only|missed|failed|behind|locked|left to do/i);
    }
  });
});
