import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeMilestone } from "@/lib/garden";
import type { Milestone } from "@/lib/types/api";

export function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestones</CardTitle>
        <CardDescription>
          {milestones.length === 0
            ? "Your first milestone is waiting just around the corner. 🌱"
            : "Little celebrations along the way. They're yours to keep."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => (
            <li
              key={`${m.milestone_type}-${m.trigger_value}`}
              className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
            >
              🌟 {describeMilestone(m.milestone_type, m.trigger_value)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
