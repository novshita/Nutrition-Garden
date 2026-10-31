"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { itemEmoji, itemLabel } from "@/lib/garden";
import type { GardenItem } from "@/lib/types/api";

export type Placement = { x: number; y: number; rotation: number };

export function ItemPicker({
  items,
  selectedId,
  placement,
  busy,
  onSelect,
  onChange,
  onPlace,
}: {
  items: GardenItem[];
  selectedId: string | null;
  placement: Placement;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onChange: (placement: Placement) => void;
  onPlace: () => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const percent = (value: number) => Math.round(value * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your garden items</CardTitle>
        <CardDescription>
          Choose an item, then click your garden to place it, or use the sliders. You can move items any
          time. New ones unlock as your garden grows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Button
                type="button"
                size="sm"
                variant={item.id === selectedId ? "default" : "outline"}
                aria-pressed={item.id === selectedId}
                onClick={() => onSelect(item.id === selectedId ? null : item.id)}
              >
                {itemEmoji(item.item_key, item.item_type)} {itemLabel(item.item_key)}
                <span className="text-xs opacity-70">{item.placed ? "· placed" : "· new"}</span>
              </Button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="flex flex-col gap-3 rounded-xl bg-secondary p-3">
            <p className="text-sm font-medium">
              {itemEmoji(selected.item_key, selected.item_type)} {itemLabel(selected.item_key)}
            </p>
            <Slider
              id="place-x"
              label={`Left to right (${percent(placement.x)}%)`}
              min={0}
              max={100}
              value={percent(placement.x)}
              onChange={(v) => onChange({ ...placement, x: v / 100 })}
            />
            <Slider
              id="place-y"
              label={`Top to bottom (${percent(placement.y)}%)`}
              min={0}
              max={100}
              value={percent(placement.y)}
              onChange={(v) => onChange({ ...placement, y: v / 100 })}
            />
            <Slider
              id="place-rotation"
              label={`Turn (${placement.rotation}°)`}
              min={-180}
              max={180}
              value={placement.rotation}
              onChange={(v) => onChange({ ...placement, rotation: v })}
            />
            <Button type="button" onClick={onPlace} disabled={busy} className="self-start">
              {busy ? "Saving…" : selected.placed ? "Move here" : "Place in my garden"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
      />
    </div>
  );
}
