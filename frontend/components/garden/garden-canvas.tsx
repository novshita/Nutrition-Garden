"use client";

import { useRef } from "react";
import { bunnyStageName, itemEmoji, itemLabel, pointToPosition } from "@/lib/garden";
import type { GardenItem } from "@/lib/types/api";

/**
 * The garden itself. Placed items sit at their saved position (0..1 across and down). Clicking an
 * empty spot while an item is selected places it there. Placeholder art; swap the visuals freely.
 */
export function GardenCanvas({
  items,
  selectedId,
  bunnyStage,
  onPlace,
}: {
  items: GardenItem[];
  selectedId: string | null;
  bunnyStage: number;
  onPlace: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedId || !ref.current) return;
    const position = pointToPosition(event.clientX, event.clientY, ref.current.getBoundingClientRect());
    if (position) onPlace(position.x, position.y);
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      role="img"
      aria-label={`Your garden with ${items.filter((i) => i.placed).length} items placed and a ${bunnyStageName(bunnyStage)}`}
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-secondary to-accent/40 ${
        selectedId ? "cursor-crosshair" : ""
      }`}
    >
      {items
        .filter((item) => item.placed && item.position)
        .map((item) => (
          <span
            key={item.id}
            title={itemLabel(item.item_key)}
            className={`absolute text-3xl select-none ${item.id === selectedId ? "drop-shadow-[0_0_6px_var(--primary)]" : ""}`}
            style={{
              left: `${item.position!.x * 100}%`,
              top: `${item.position!.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)`,
            }}
          >
            {itemEmoji(item.item_key, item.item_type)}
          </span>
        ))}
      <span
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-5xl select-none"
        title={bunnyStageName(bunnyStage)}
      >
        🐰
      </span>
    </div>
  );
}
