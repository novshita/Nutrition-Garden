"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  chosenFood,
  confidenceLabel,
  unitAfterChoosing,
  unitOptions,
  type ReviewItem,
} from "@/lib/ai";

/** One food from the AI's proposal. The person decides what it was and how much. */
export function ReviewRow({
  item,
  onChange,
}: {
  item: ReviewItem;
  onChange: (changes: Partial<ReviewItem>) => void;
}) {
  const id = (name: string) => `review-${item.key}-${name}`;
  const food = chosenFood(item);
  const heard = [item.quantity, item.unit].filter(Boolean).join(" ");

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-3">
      <div>
        <h3 className="font-medium">
          {item.name}
          {item.preparation && <span className="font-normal text-muted-foreground"> ({item.preparation})</span>}
        </h3>
        <p className="text-sm text-muted-foreground">
          {heard ? `I heard: ${heard}` : "I wasn't sure how much"} · how sure: {confidenceLabel(item.confidence)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={id("quantity")}>Amount</Label>
        <Input
          id={id("quantity")}
          inputMode="decimal"
          className="w-28"
          value={item.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What was it?</legend>
        {item.matches.map((match) => (
          <label key={match.fdc_id} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={id("choice")}
              className="mt-1 accent-primary"
              checked={item.choice === `usda:${match.fdc_id}`}
              onChange={() =>
                onChange({ choice: `usda:${match.fdc_id}`, unit: unitAfterChoosing(item, match) })
              }
            />
            <span>
              {match.name}
              <span className="text-muted-foreground">
                {match.nutrition_per_100g.calories === null
                  ? " · calories unknown"
                  : ` · ${Math.round(match.nutrition_per_100g.calories)} kcal per 100 g`}
              </span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={id("choice")}
            className="mt-1 accent-primary"
            checked={item.choice === "custom"}
            onChange={() => onChange({ choice: "custom" })}
          />
          <span>
            {item.matches.length === 0
              ? "No database matches. I'll enter the calories myself"
              : "None of these. I'll enter the calories myself"}
          </span>
        </label>
      </fieldset>

      {food && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={id("unit")}>Unit</Label>
          <NativeSelect id={id("unit")} value={item.unit} onChange={(e) => onChange({ unit: e.target.value })}>
            <option value="">Choose…</option>
            {unitOptions(food).map((unit) => (
              <option key={unit} value={unit}>
                {unit === "g" ? "grams (g)" : unit}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {item.choice === "custom" && (
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={id("custom-unit")}>In</Label>
            <Input id={id("custom-unit")} className="w-36" placeholder="bowl, slice, g…" value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={id("calories")}>Calories (kcal)</Label>
            <Input id={id("calories")} inputMode="decimal" className="w-32" value={item.customCalories} onChange={(e) => onChange({ customCalories: e.target.value })} />
          </div>
        </div>
      )}
    </section>
  );
}
