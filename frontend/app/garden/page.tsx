"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GardenCanvas } from "@/components/garden/garden-canvas";
import { ItemPicker, type Placement } from "@/components/garden/item-picker";
import { MilestonesCard } from "@/components/garden/milestones-card";
import { GardenCard } from "@/components/garden/garden-card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { bunnyStageName } from "@/lib/garden";
import type { Garden, GardenItem, Milestone } from "@/lib/types/api";

const DEFAULT_PLACEMENT: Placement = { x: 0.5, y: 0.5, rotation: 0 };

export default function GardenPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  const garden = useApi<Garden>(ready ? "/garden" : null);
  const items = useApi<GardenItem[]>(ready ? "/garden/items" : null);
  const milestones = useApi<Milestone[]>(ready ? "/garden/milestones" : null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [busy, setBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  if (loading || (!user && error?.status === 401) || (user && !profile.data && !profile.error)) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }
  if (!user) {
    return <p className="m-auto text-destructive">{error?.message ?? "Something went wrong."}</p>;
  }
  if (profile.error && profile.error.status !== 404) {
    return <p className="m-auto text-destructive">{profile.error.message}</p>;
  }
  if (!profile.data) {
    return <p className="m-auto text-muted-foreground">One moment…</p>;
  }

  function select(id: string | null) {
    setSelectedId(id);
    setPlaceError(null);
    const item = items.data?.find((i) => i.id === id);
    // Start from where the item already is, so moving it is a small nudge.
    setPlacement(
      item?.position
        ? { x: item.position.x, y: item.position.y, rotation: Math.round(item.rotation ?? 0) }
        : DEFAULT_PLACEMENT,
    );
  }

  async function place(next: Placement) {
    if (!selectedId) return;
    setBusy(true);
    setPlaceError(null);
    try {
      await api(`/garden/items/${selectedId}/place`, { method: "POST", body: next });
      items.reload();
    } catch (caught) {
      setPlaceError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">My garden</h1>

      {garden.data && (
        <p className="text-muted-foreground">
          {bunnyStageName(garden.data.bunny_stage)} · stage {garden.data.growth_stage}
        </p>
      )}

      {items.data && garden.data ? (
        <>
          <GardenCanvas
            items={items.data}
            selectedId={selectedId}
            bunnyStage={garden.data.bunny_stage}
            onPlace={(x, y) => {
              const next = { ...placement, x, y };
              setPlacement(next);
              void place(next);
            }}
          />
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {placeError}
          </p>
          <ItemPicker
            items={items.data}
            selectedId={selectedId}
            placement={placement}
            busy={busy}
            onSelect={select}
            onChange={setPlacement}
            onPlace={() => place(placement)}
          />
        </>
      ) : (
        <p className="text-muted-foreground">
          {(items.error ?? garden.error)?.message ?? "Watering the garden…"}
        </p>
      )}

      {garden.data && <GardenCard garden={garden.data} />}
      {milestones.data && <MilestonesCard milestones={milestones.data} />}
    </div>
  );
}
