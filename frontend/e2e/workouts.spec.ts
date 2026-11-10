import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard, visit } from "./helpers";

async function createWorkout(page: Page, name: string, exercise: string, sets = "2") {
  const form = page.locator("form", { has: page.locator("#tpl-name-new") });
  await form.locator("#tpl-name-new").fill(name);
  const first = form.locator("fieldset").first();
  await first.getByLabel("Name").fill(exercise);
  await first.getByLabel("Sets").fill(sets);
  await first.getByLabel("Reps").fill("10");
  await form.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("region", { name })).toBeVisible();
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

test.describe("workouts", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/workouts");
  });

  test("a workout can be edited: renamed, changed and given a new exercise", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByRole("button", { name: "Edit Upper Body" }).click();

    const form = page.locator("form", { has: page.getByRole("button", { name: "Save changes" }) });
    await form.getByLabel("Name").first().fill("Strength A");
    await form.locator("fieldset").first().getByLabel("Reps").fill("15");
    await form.getByRole("button", { name: "+ Add another exercise" }).click();
    await form.locator("fieldset").nth(1).getByLabel("Name").fill("Squats");
    await form.getByRole("button", { name: "Save changes" }).click();

    const section = page.getByRole("region", { name: "Strength A" });
    await expect(section).toBeVisible();
    await expect(section.getByText("Push-ups")).toContainText("2 × 15 reps");
    await expect(section.getByText("Squats")).toBeVisible();
    await expect(page.getByRole("region", { name: "Upper Body" })).toHaveCount(0);
  });

  test("cancelling an edit changes nothing", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByRole("button", { name: "Edit Upper Body" }).click();
    const form = page.locator("form", { has: page.getByRole("button", { name: "Save changes" }) });
    await form.getByLabel("Name").first().fill("Something else");
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("region", { name: "Upper Body" })).toBeVisible();
  });

  test("an invalid edit is refused and nothing is lost", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByRole("button", { name: "Edit Upper Body" }).click();
    const form = page.locator("form", { has: page.getByRole("button", { name: "Save changes" }) });
    await form.getByLabel("Name").first().fill("   ");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form.getByText("Please give the workout a name.")).toBeVisible();
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("region", { name: "Upper Body" })).toBeVisible();
  });

  test("deleting asks first, and 'keep it' keeps it", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByRole("button", { name: "Delete Upper Body" }).click();
    await expect(page.getByText(/It will also leave your weekly plan/)).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("region", { name: "Upper Body" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Upper Body" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page.getByRole("region", { name: "Upper Body" })).toHaveCount(0);
    await expect(page.getByText("No workouts yet.")).toBeVisible();
  });

  test("recording each set shows them in the history, and history outlives the workout", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups", "3");

    await page.getByLabel("Which workout?").selectOption({ label: "Upper Body" });
    await page.getByLabel("Day", { exact: true }).fill(daysAgo(2));
    await page.getByLabel("Started at").fill("08:00");
    await page.getByLabel("Minutes").fill("30");
    await page.getByLabel("Record each set (optional)").check();

    await page.getByLabel("Push-ups, set 1 done").check();
    await page.getByLabel("Push-ups, set 1 reps").fill("12");
    await page.getByLabel("Push-ups, set 2 done").check();
    await page.getByLabel("Push-ups, set 2 reps").fill("9");
    // set 3 is left unticked, so it isn't recorded
    await page.getByRole("button", { name: "Save workout" }).last().click();

    const history = page.getByRole("listitem").filter({ hasText: "Push-ups: 2 sets (12, 9 reps)" });
    await expect(history).toBeVisible();
    await expect(history).toContainText("Upper Body");

    // Delete the workout: the recorded session keeps its name and its sets.
    await page.getByRole("button", { name: "Delete Upper Body" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page.getByRole("region", { name: "Upper Body" })).toHaveCount(0);
    const kept = page.getByRole("listitem").filter({ hasText: "Push-ups: 2 sets (12, 9 reps)" });
    await expect(kept).toBeVisible();
    await expect(kept).toContainText("Upper Body");
  });

  test("a recorded workout can be deleted after confirming", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByLabel("Which workout?").selectOption({ label: "Upper Body" });
    await page.getByLabel("Day", { exact: true }).fill(daysAgo(2));
    await page.getByLabel("Started at").fill("08:00");
    await page.getByLabel("Minutes").fill("20");
    await page.getByRole("button", { name: "Save workout" }).last().click();
    const item = page.getByRole("listitem").filter({ hasText: "Upper Body" }).filter({ hasText: "20 min" });
    await expect(item).toBeVisible();

    await item.getByRole("button", { name: /^Delete workout/ }).click();
    await item.getByRole("button", { name: "Keep it" }).click(); // changing my mind leaves it alone
    await expect(item).toBeVisible();

    await item.getByRole("button", { name: /^Delete workout/ }).click();
    await item.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(item).toHaveCount(0);
    await expect(page.getByText("Nothing recorded yet, and that's fine.")).toBeVisible();
  });

  test("a session can still be recorded without any per-set detail", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByLabel("Which workout?").selectOption({ label: "Upper Body" });
    await page.getByLabel("Day", { exact: true }).fill(daysAgo(2));
    await page.getByLabel("Started at").fill("08:00");
    await page.getByLabel("Minutes").fill("20");
    await page.getByRole("button", { name: "Save workout" }).last().click();
    const item = page.getByRole("listitem").filter({ hasText: "Upper Body" }).filter({ hasText: "20 min" });
    await expect(item).toBeVisible();
    await expect(item).not.toContainText("set");
  });

  test("a bad number on a ticked set is refused", async ({ page }) => {
    await createWorkout(page, "Upper Body", "Push-ups");
    await page.getByLabel("Which workout?").selectOption({ label: "Upper Body" });
    await page.getByLabel("Day", { exact: true }).fill(daysAgo(2));
    await page.getByLabel("Started at").fill("08:00");
    await page.getByLabel("Minutes").fill("20");
    await page.getByLabel("Record each set (optional)").check();
    await page.getByLabel("Push-ups, set 1 done").check();
    await page.getByLabel("Push-ups, set 1 reps").fill("lots");
    await page.getByRole("button", { name: "Save workout" }).last().click();
    await expect(page.getByText(/Push-ups, set 1: reps should be a whole number/)).toBeVisible();
  });
});

test("water shows progress toward the 2 litre goal", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByText("of 2 L").first()).toBeVisible(); // dashboard tile

  await visit(page, "/track");
  await expect(page.getByText("0 ml of 2 L")).toBeVisible();
  await expect(page.getByText("A glass of water is a lovely place to start.")).toBeVisible();

  await page.getByRole("button", { name: "+ 500 ml" }).click();
  await expect(page.getByText("500 ml of 2 L")).toBeVisible();
  await expect(page.getByText("1.5 L still to sip today.")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Water toward today's goal" })).toHaveAttribute(
    "aria-valuenow",
    "25",
  );

  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "+ 500 ml" }).click();
  await expect(page.getByText("2 L of 2 L")).toBeVisible();
  await expect(page.getByText("You've reached today's water goal.")).toBeVisible();

  await page.getByRole("button", { name: "+ 500 ml" }).click(); // going over is fine
  await expect(page.getByText("2.5 L of 2 L")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Water toward today's goal" })).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
});
