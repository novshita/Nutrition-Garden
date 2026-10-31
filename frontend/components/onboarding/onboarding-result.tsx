import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileSummary } from "@/lib/types/api";

/** Shown once after onboarding: the numbers the backend calculated. */
export function OnboardingResult({
  summary,
  onContinue,
}: {
  summary: ProfileSummary;
  onContinue: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-diary text-3xl">Your garden is planted 🌱</CardTitle>
        <CardDescription>Here&apos;s where we&apos;re starting from.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4">
          <Stat label="Daily calorie estimate" value={`${summary.calorie_target_kcal} kcal`} />
          <Stat label="BMI" value={summary.bmi.toFixed(1)} />
        </dl>
        <p className="text-sm text-muted-foreground">
          The calorie estimate is a starting point for gradual weight gain, not medical advice. You
          can review and change it any time. BMI is just one number, not a verdict.
        </p>
        <Button onClick={onContinue}>Go to my garden</Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
