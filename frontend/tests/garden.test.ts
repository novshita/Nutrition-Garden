import { describe, expect, it } from "vitest";
import {
  bunnyStageName,
  describeMilestone,
  itemEmoji,
  itemLabel,
  pointToPosition,
} from "@/lib/garden";
import type { MilestoneType } from "@/lib/types/api";

describe("pointToPosition", () => {
  const rect = { left: 100, top: 50, width: 400, height: 300 };

  it("turns a click into 0..1 coordinates across and down", () => {
    expect(pointToPosition(300, 200, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointToPosition(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(pointToPosition(500, 350, rect)).toEqual({ x: 1, y: 1 });
  });

  it("rounds to three decimals", () => {
    expect(pointToPosition(233, 120, rect)).toEqual({ x: 0.333, y: 0.233 });
  });

  it("keeps clicks on the edge or just outside inside the garden", () => {
    expect(pointToPosition(50, 10, rect)).toEqual({ x: 0, y: 0 });
    expect(pointToPosition(900, 900, rect)).toEqual({ x: 1, y: 1 });
  });

  it("gives nothing for an empty box", () => {
    expect(pointToPosition(10, 10, { left: 0, top: 0, width: 0, height: 100 })).toBeNull();
    expect(pointToPosition(10, 10, { left: 0, top: 0, width: 100, height: 0 })).toBeNull();
  });
});

describe("items", () => {
  it("has a picture for each known item, and falls back by type, then to a seedling", () => {
    expect(itemEmoji("tulip", "FLOWER")).toBe("🌷");
    expect(itemEmoji("brand_new_flower", "FLOWER")).toBe("🌸");
    expect(itemEmoji("brand_new_thing", "MYSTERY")).toBe("🌱");
  });
  it("makes readable names", () => {
    expect(itemLabel("cherry_blossom_tree")).toBe("Cherry blossom tree");
    expect(itemLabel("tulip")).toBe("Tulip");
  });
});

describe("bunny stages", () => {
  it("names the five stages and stays sensible beyond them", () => {
    expect(bunnyStageName(1)).toBe("Little sprout bunny");
    expect(bunnyStageName(5)).toBe("Starlight bunny");
    expect(bunnyStageName(9)).toBe("Starlight bunny");
  });
});

describe("describeMilestone", () => {
  it("describes every milestone positively", () => {
    const cases: [MilestoneType, number, string][] = [
      ["FIRST_LOG", 1, "Your first food log"],
      ["FIRST_WEEK", 7, "7 days of looking after yourself"],
      ["WORKOUT_STREAK", 3, "Workouts on 3 different days"],
      ["HYDRATION_MILESTONE", 30, "Water logged on 30 days"],
      ["WEIGHT_MILESTONE", 50, "50% of the way to your goal weight"],
      ["GARDEN_STAGE", 2, "Your garden reached stage 2"],
    ];
    for (const [type, value, text] of cases) expect(describeMilestone(type, value)).toBe(text);
  });
});
