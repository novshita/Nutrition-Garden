import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dayBarPercent, guideText, weekdayLetter, weekDetail, weekHeadline } from "@/lib/protein";
import type { ProteinWeek, UnitSystem } from "@/lib/types/api";

/** The week's protein: what you've had, with a soft reminder. Never a target to hit or miss. */
export function ProteinWeekCard({ week, unit }: { week: ProteinWeek; unit: UnitSystem }) {
  const detail = weekDetail(week);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Protein this week</CardTitle>
        <CardDescription>{weekHeadline(week)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {detail && <p className="text-sm">{detail}</p>}
        <ul className="grid grid-cols-7 gap-2" aria-label="Protein each day">
          {week.days.map((day) => (
            <li key={day.date} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <div className="flex h-16 w-full items-end rounded-md bg-secondary">
                <div
                  className="w-full rounded-md bg-primary"
                  style={{ height: `${dayBarPercent(day, week)}%` }}
                  role="img"
                  aria-label={
                    day.protein_g === null
                      ? `${weekdayLetter(day.date)}: nothing logged`
                      : `${weekdayLetter(day.date)}: ${Math.round(day.protein_g)} grams`
                  }
                />
              </div>
              <span>{weekdayLetter(day.date)}</span>
              <span>{day.protein_g === null ? "–" : Math.round(day.protein_g)}</span>
            </li>
          ))}
        </ul>
        {week.guide && <p className="text-sm text-muted-foreground">{guideText(week.guide, unit)}</p>}
      </CardContent>
    </Card>
  );
}
