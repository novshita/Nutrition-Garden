import { expect, test } from "@playwright/test";
import { signUpAndOnboard, visit } from "./helpers";

test.describe("a first day in the garden", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page);
  });

  test("the dashboard starts empty and calm", async ({ page }) => {
    await expect(page.getByText("Nothing logged yet.")).toBeVisible();
    await expect(page.getByText("not tracked yet today")).toBeVisible();
  });

  test("logging my own food updates the dashboard", async ({ page }) => {
    await page.getByRole("link", { name: "Food", exact: true }).click();
    await page.getByRole("button", { name: "Add my own" }).click();
    await page.getByLabel("Food", { exact: true }).fill("Peanut butter toast");
    await page.getByLabel("Amount").fill("2");
    await page.getByLabel("In", { exact: true }).fill("slice");
    await page.getByLabel("Calories (kcal)").fill("450");
    await page.getByLabel(/^Protein/).fill("15");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await expect(page.getByText("1 food ready to save.")).toBeVisible();

    await page.getByLabel("Which meal?").selectOption("BREAKFAST");
    await page.getByRole("button", { name: "Save meal" }).click();
    await expect(page.getByText("Peanut butter toast").first()).toBeVisible();

    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByText(/^450 of [\d,]+ kcal$/)).toBeVisible();
    await expect(page.getByText("15 g")).toBeVisible();
  });

  test("nothing is saved until I save the meal, and I can remove a food", async ({ page }) => {
    await visit(page, "/food");
    await page.getByRole("button", { name: "Add my own" }).click();
    await page.getByLabel("Food", { exact: true }).fill("Oat bar");
    await page.getByLabel("Amount").fill("1");
    await page.getByLabel("In", { exact: true }).fill("bar");
    await page.getByLabel("Calories (kcal)").fill("200");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(/Nothing is saved until you save the meal/)).toBeVisible();

    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByText("Nothing logged yet.")).toBeVisible();
  });

  test("a food with no calories gets a helpful message", async ({ page }) => {
    await visit(page, "/food");
    await page.getByRole("button", { name: "Add my own" }).click();
    await page.getByLabel("Food", { exact: true }).fill("Mystery");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await expect(page.getByText("Please enter calories between 0 and")).toBeVisible();
  });

  test("logging weight shows it in the list", async ({ page }) => {
    await visit(page, "/weight");
    await page.getByLabel("Weight (kg)").fill("52.4");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByText("52.4 kg").first()).toBeVisible();
  });

  test("a weight that makes no sense is refused", async ({ page }) => {
    await visit(page, "/weight");
    await page.getByLabel("Weight (kg)").fill("5");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  });

  test("water can be added and removed", async ({ page }) => {
    await visit(page, "/track");
    await expect(page.getByRole("heading", { name: "Daily check-in" })).toBeVisible();
    await page.getByRole("button", { name: /^\+ / }).first().click();
    await expect(page.getByRole("button", { name: /^Remove .* at / })).toHaveCount(1);
    await page.getByRole("button", { name: /^Remove .* at / }).click();
    await expect(page.getByRole("button", { name: /^Remove .* at / })).toHaveCount(0);
  });

  test("every page in the header opens without an error", async ({ page }) => {
    const links = await page.getByRole("navigation", { name: "Main" }).getByRole("link").all();
    const hrefs = await Promise.all(links.map((link) => link.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThanOrEqual(13);
    for (const href of hrefs) {
      await visit(page, href!);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    }
  });

  test("the fairy is resting when AI is off, and the rest of the app works", async ({ page }) => {
    await visit(page, "/fairy");
    await expect(page.getByText("The fairy is resting")).toBeVisible();
    await visit(page, "/food");
    await page.getByRole("button", { name: "Tell the fairy 🧚" }).click();
    await visit(page, "/");
    await expect(page.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();
  });
});

test("settings: a change moves the estimate but never the goal", async ({ page }) => {
  await signUpAndOnboard(page);
  await visit(page, "/goals");
  const goal = page.getByText(/^[\d,]+ kcal$/).first();
  await expect(goal).toBeVisible();
  const goalBefore = await goal.innerText();

  await visit(page, "/settings");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Nothing to change.")).toBeVisible();

  await page.getByLabel("Usual activity level").selectOption("VERY_ACTIVE");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved 🌱")).toBeVisible();
  await expect(page.getByText(/Your daily goal stays at/)).toBeVisible();

  await visit(page, "/goals");
  await expect(page.getByText(goalBefore, { exact: true }).first()).toBeVisible();
});
