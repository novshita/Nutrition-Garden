"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { FoodItem, FoodSearchResponse } from "@/lib/types/api";

const MIN_QUERY = 2;

export function FoodSearch({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<FoodSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < MIN_QUERY) {
      setError(`Please type at least ${MIN_QUERY} letters.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setResult(await api<FoodSearchResponse>(`/food/search?query=${encodeURIComponent(text)}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={search} className="flex flex-col gap-2" noValidate>
        <Label htmlFor="food-search">Search for a food</Label>
        <div className="flex gap-2">
          <Input
            id="food-search"
            value={query}
            placeholder="e.g. egg, rice, banana"
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>
      </form>
      <p role="alert" className="min-h-5 text-sm text-destructive">
        {error}
      </p>

      {result?.source === "cache" && (
        <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          The food database can&apos;t be reached right now, so this only lists foods you&apos;ve used
          before. You can try again in a moment, or add your own food instead.
        </p>
      )}

      {result && result.results.length === 0 && result.source === "usda" && (
        <p className="text-sm text-muted-foreground">
          No matches for “{result.query}”. Try a simpler word, or add your own food.
        </p>
      )}
      {result && result.results.length === 0 && result.source === "cache" && (
        <p className="text-sm text-muted-foreground">No saved foods match “{result.query}”.</p>
      )}

      {result && result.results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.results.map((food) => (
            <li key={food.fdc_id}>
              <button
                type="button"
                onClick={() => onSelect(food)}
                className="w-full rounded-lg border bg-card p-3 text-left hover:bg-secondary"
              >
                <span className="block font-medium">{food.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {food.brand ? `${food.brand} · ` : ""}
                  {food.nutrition_per_100g.calories === null
                    ? "calories unknown"
                    : `${Math.round(food.nutrition_per_100g.calories)} kcal per 100 g`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
