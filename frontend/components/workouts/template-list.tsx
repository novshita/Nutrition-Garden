import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkoutTemplate } from "@/lib/types/api";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, describeExercise } from "@/lib/workouts";

export function TemplateList({ templates }: { templates: WorkoutTemplate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your workouts</CardTitle>
        <CardDescription>
          {templates.length === 0
            ? "No workouts yet. Create your first one below."
            : "Pick these in your weekly plan or when you record a session."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {templates.map((template) => (
          <section key={template.id} className="flex flex-col gap-1">
            <h3 className="font-medium">
              {template.name}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {DIFFICULTY_LABELS[template.difficulty]}
              </span>
            </h3>
            {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
            <ul className="flex flex-col gap-1 text-sm">
              {template.exercises.map((exercise) => (
                <li key={exercise.id} className="rounded-lg bg-secondary px-3 py-1.5">
                  {exercise.exercise_name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {describeExercise(exercise)} · {CATEGORY_LABELS[exercise.category]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
