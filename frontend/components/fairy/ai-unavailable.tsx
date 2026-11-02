import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown when AI isn't set up. Everything else in the app keeps working. */
export function AiUnavailable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The fairy is resting 🌙</CardTitle>
        <CardDescription>This part of the garden isn&apos;t switched on yet.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Everything else works as usual: logging food, tracking your day, your workouts and your garden.
      </CardContent>
    </Card>
  );
}
