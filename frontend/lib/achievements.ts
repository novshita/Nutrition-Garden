/** Achievements page rules: group the list and count what's earned. Nothing is ever lost. */

import type { Achievement, MilestoneType } from "@/lib/types/api";

export const GROUP_TITLES: Record<MilestoneType, string> = {
  FIRST_LOG: "First steps",
  FIRST_WORKOUT: "First steps",
  FIRST_WEEK: "First steps",
  CONSISTENT_TRACKING: "Showing up",
  WORKOUT_STREAK: "Moving",
  HYDRATION_MILESTONE: "Hydration",
  WEIGHT_MILESTONE: "Toward your goal",
  GARDEN_STAGE: "Your garden",
};

export type AchievementGroup = { title: string; items: Achievement[] };

/** Groups in the order they first appear, keeping the API's order inside each group. */
export function groupAchievements(list: Achievement[]): AchievementGroup[] {
  const groups = new Map<string, Achievement[]>();
  for (const achievement of list) {
    const title = GROUP_TITLES[achievement.milestone_type] ?? "More";
    groups.set(title, [...(groups.get(title) ?? []), achievement]);
  }
  return [...groups.entries()].map(([title, items]) => ({ title, items }));
}

export function countEarned(list: Achievement[]): { earned: number; ahead: number } {
  const earned = list.filter((a) => a.unlocked).length;
  return { earned, ahead: list.length - earned };
}

/** Warm, never-negative wording for how many are earned. */
export function earnedSummary(list: Achievement[]): string {
  const { earned, ahead } = countEarned(list);
  if (earned === 0) return "Your first achievement is waiting just around the corner. 🌱";
  const noun = earned === 1 ? "achievement" : "achievements";
  return ahead === 0
    ? `You've earned all ${earned} achievements. 🌟`
    : `You've earned ${earned} ${noun}, with ${ahead} more to look forward to. 🌟`;
}
