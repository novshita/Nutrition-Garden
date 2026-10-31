import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInt, formatShortDate } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/goals";
import type { CalorieTarget } from "@/lib/types/api";
import { localDate } from "@/lib/weight";

export function TargetHistory({ history, timeZone }: { history: CalorieTarget[]; timeZone: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Every goal you&apos;ve had, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {history.map((target) => (
            <li key={target.effective_from} className="rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="font-medium">{formatInt(target.target_kcal)} kcal</span>
              <span className="text-muted-foreground">
                {" "}
                · from {formatShortDate(localDate(target.effective_from, timeZone))} ·{" "}
                {SOURCE_LABELS[target.source]}
                {target.effective_until === null && " · current"}
              </span>
              {target.reason && <p className="text-muted-foreground">{target.reason}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
