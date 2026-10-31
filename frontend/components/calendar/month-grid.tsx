"use client";

import { buildMonthGrid, cellMarks, type YearMonth } from "@/lib/calendar";
import { formatLongDate } from "@/lib/format";
import type { CalendarDay } from "@/lib/types/api";

const HEADINGS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  month,
  days,
  today,
  selected,
  onSelect,
}: {
  month: YearMonth;
  days: CalendarDay[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const weeks = buildMonthGrid(month, days);

  return (
    <div className="grid grid-cols-7 gap-1">
      {HEADINGS.map((heading) => (
        <div key={heading} className="text-center text-xs text-muted-foreground">
          {heading}
        </div>
      ))}
      {weeks.flat().map((cell, index) =>
        cell === null ? (
          <div key={`empty-${index}`} aria-hidden />
        ) : (
          <button
            key={cell.date}
            type="button"
            onClick={() => onSelect(cell.date)}
            aria-pressed={cell.date === selected}
            aria-label={`${formatLongDate(cell.date)}${cell.date === today ? ", today" : ""}${
              cell.data?.has_activity ? ", something logged" : ""
            }`}
            className={`flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left text-sm transition-colors hover:bg-secondary ${
              cell.date === selected ? "border-primary bg-secondary" : ""
            } ${cell.date === today ? "ring-2 ring-primary/40" : ""}`}
          >
            <span className="font-medium">{cell.dayOfMonth}</span>
            <span className="flex flex-wrap gap-0.5 text-xs leading-none" aria-hidden>
              {cell.data &&
                cellMarks(cell.data)
                  .slice(0, 4)
                  .map((mark) => (
                    <span key={mark.label} title={mark.label}>
                      {mark.emoji}
                    </span>
                  ))}
            </span>
          </button>
        ),
      )}
    </div>
  );
}
