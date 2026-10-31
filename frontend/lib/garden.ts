/** Garden display rules. The artwork is a placeholder; the item keys and data are the real thing. */

import type { MilestoneType } from "@/lib/types/api";

const ITEM_EMOJI: Record<string, string> = {
  tulip: "🌷",
  daisy: "🌼",
  bunny_burrow: "🕳️",
  sunflower: "🌻",
  stepping_stones: "🪨",
  lantern: "🏮",
  apple_tree: "🌳",
  pond: "🪷",
  butterflies: "🦋",
  cherry_blossom_tree: "🌸",
  arch_gate: "⛩️",
  fairy_lights: "✨",
  rainbow: "🌈",
  crystal_fountain: "⛲",
  moon_garden: "🌙",
};

const TYPE_EMOJI: Record<string, string> = {
  FLOWER: "🌸",
  TREE: "🌳",
  PATH: "🪨",
  DECORATION: "🎀",
  HABITAT: "🏡",
  MAGICAL: "✨",
  SEASONAL: "🍂",
};

/** A picture for an item: its own if we have one, else its type's, else a seedling. */
export function itemEmoji(itemKey: string, itemType: string): string {
  return ITEM_EMOJI[itemKey] ?? TYPE_EMOJI[itemType] ?? "🌱";
}

/** "cherry_blossom_tree" becomes "Cherry blossom tree". */
export function itemLabel(itemKey: string): string {
  const words = itemKey.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Where a click landed on the garden, as 0..1 across and down (what the API stores). */
export function pointToPosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: round3(clamp01((clientX - rect.left) / rect.width)),
    y: round3(clamp01((clientY - rect.top) / rect.height)),
  };
}

export const BUNNY_STAGE_NAMES: Record<number, string> = {
  1: "Little sprout bunny",
  2: "Garden bunny",
  3: "Meadow bunny",
  4: "Blossom bunny",
  5: "Starlight bunny",
};

export const bunnyStageName = (stage: number): string =>
  BUNNY_STAGE_NAMES[stage] ?? BUNNY_STAGE_NAMES[Math.max(...Object.keys(BUNNY_STAGE_NAMES).map(Number))];

export function describeMilestone(type: MilestoneType, value: number): string {
  switch (type) {
    case "FIRST_LOG":
      return "Your first food log";
    case "FIRST_WEEK":
      return `${value} days of looking after yourself`;
    case "WORKOUT_STREAK":
      return `Workouts on ${value} different days`;
    case "HYDRATION_MILESTONE":
      return `Water logged on ${value} days`;
    case "WEIGHT_MILESTONE":
      return `${value}% of the way to your goal weight`;
    case "GARDEN_STAGE":
      return `Your garden reached stage ${value}`;
    default:
      return "A new milestone";
  }
}
