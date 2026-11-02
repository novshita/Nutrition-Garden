"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api/client";
import { MAX_MEMORY_TEXT, MEMORY_CATEGORY_LABELS } from "@/lib/ai";
import type { MemoryCategory } from "@/lib/types/api";

export function MemoryForm({ onAdded }: { onAdded: () => void }) {
  const [category, setCategory] = useState<MemoryCategory>("FOOD_LIKE");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || cleaned.length > MAX_MEMORY_TEXT) {
      setError(`Please write something short (up to ${MAX_MEMORY_TEXT} characters).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/memory", { method: "POST", body: { category, memory_text: cleaned } });
      setText("");
      onAdded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell the fairy something</CardTitle>
        <CardDescription>Food likes, dislikes, meal habits or routines. It&apos;s saved because you wrote it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor="memory-category">What kind?</Label>
            <NativeSelect id="memory-category" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
              {(Object.keys(MEMORY_CATEGORY_LABELS) as MemoryCategory[]).map((c) => (
                <option key={c} value={c}>
                  {MEMORY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="memory-text">What should she remember?</Label>
            <Input id="memory-text" value={text} maxLength={MAX_MEMORY_TEXT} placeholder="I love peanut butter on toast" onChange={(e) => setText(e.target.value)} />
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Saving…" : "Remember this"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
