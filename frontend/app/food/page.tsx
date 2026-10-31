"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CustomFoodFormView } from "@/components/food/custom-food-form";
import { FoodLogList } from "@/components/food/food-log-list";
import { FoodSearch } from "@/components/food/food-search";
import { MealDraft, type DraftItem } from "@/components/food/meal-draft";
import { NutritionTotals } from "@/components/food/nutrition-totals";
import { PortionPicker } from "@/components/food/portion-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { FoodItemPayload } from "@/lib/food";
import type { DailyNutrition, FoodItem, FoodLogDay } from "@/lib/types/api";

type Mode = "search" | "custom";

export default function FoodPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const ready = profile.data !== null;
  const logs = useApi<FoodLogDay>(ready ? "/food/log" : null);
  const daily = useApi<DailyNutrition>(ready ? "/nutrition/daily" : null);

  const [mode, setMode] = useState<Mode>("search");
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);

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

  const addToDraft = (label: string, item: FoodItemPayload) => {
    setDraft((current) => [...current, { key: crypto.randomUUID(), label, item }]);
    setSelected(null);
  };
  const refresh = () => {
    logs.reload();
    daily.reload();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Food</h1>

      {daily.data && <NutritionTotals daily={daily.data} />}

      <Card>
        <CardHeader>
          <CardTitle>Add food</CardTitle>
          <div className="flex gap-2 pt-2" role="group" aria-label="How to add food">
            <Button
              type="button"
              variant={mode === "search" ? "default" : "outline"}
              aria-pressed={mode === "search"}
              onClick={() => setMode("search")}
            >
              Search foods
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "outline"}
              aria-pressed={mode === "custom"}
              onClick={() => setMode("custom")}
            >
              Add my own
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode === "search" ? (
            <>
              <FoodSearch onSelect={setSelected} />
              {selected && (
                <PortionPicker
                  key={selected.fdc_id}
                  food={selected}
                  onAdd={addToDraft}
                  onCancel={() => setSelected(null)}
                />
              )}
            </>
          ) : (
            <CustomFoodFormView onAdd={addToDraft} />
          )}
        </CardContent>
      </Card>

      <MealDraft
        items={draft}
        onRemove={(key) => setDraft((current) => current.filter((i) => i.key !== key))}
        onSaved={() => {
          setDraft([]);
          refresh();
        }}
      />

      {logs.data ? (
        <FoodLogList logs={logs.data.logs} onChanged={refresh} />
      ) : (
        <p className="text-muted-foreground">
          {logs.error ? logs.error.message : "Gathering today's meals…"}
        </p>
      )}
    </div>
  );
}
