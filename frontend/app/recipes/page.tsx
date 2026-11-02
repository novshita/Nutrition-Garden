"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFormView } from "@/components/recipes/recipe-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import type { Recipe } from "@/lib/types/api";

export default function RecipesPage() {
  const { user, loading, error, signOut } = useSession();
  const profile = useProfile(user !== null);
  const recipes = useApi<Recipe[]>(profile.data ? "/recipes" : null);
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <AppHeader onSignOut={signOut} />
      <h1 className="font-diary text-4xl">Recipes</h1>
      <p className="text-muted-foreground">
        Your own go-to meals. Save them once, then log a serving whenever you eat one.
      </p>

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle>New recipe</CardTitle>
          </CardHeader>
          <CardContent>
            <RecipeFormView
              onCancel={() => setCreating(false)}
              onSaved={() => {
                setCreating(false);
                recipes.reload();
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Button type="button" className="self-start" onClick={() => setCreating(true)}>
          + New recipe
        </Button>
      )}

      {recipes.data ? (
        recipes.data.length === 0 ? (
          <p className="text-muted-foreground">
            No recipes yet. Add your first one, or save an idea from the fairy.
          </p>
        ) : (
          recipes.data.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} onChanged={recipes.reload} />)
        )
      ) : (
        <p className="text-muted-foreground">{recipes.error ? recipes.error.message : "Opening the recipe box…"}</p>
      )}
    </div>
  );
}
