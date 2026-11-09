import { expect, test } from "@playwright/test";
import { signUpAndOnboard, visit } from "./helpers";

test.describe("protein", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page); // 52 kg
  });

  test("starts calm: no total, a gentle reminder for this weight, and no target", async ({ page }) => {
    await expect(page.getByText("Protein this week")).toBeVisible();
    await expect(page.getByText("No protein logged this week yet.")).toBeVisible();
    await expect(
      page.getByText("A gentle reminder: at 52 kg, many people aim for roughly 62–83 g of protein a day. It's a guide, not a goal."),
    ).toBeVisible();
    await expect(page.getByText(/protein target/i)).toHaveCount(0);
    await expect(page.getByText(/a gentle guide for you: about 62–83 g a day/)).toBeVisible();
  });

  test("logged protein adds up for the week", async ({ page }) => {
    await visit(page, "/food");
    for (const [name, protein] of [["Eggs", "18"], ["Lentils", "12"]]) {
      await page.getByRole("button", { name: "Add my own" }).click();
      await page.getByLabel("Food", { exact: true }).fill(name);
      await page.getByLabel("Amount").fill("1");
      await page.getByLabel("In", { exact: true }).fill("plate");
      await page.getByLabel("Calories (kcal)").fill("250");
      await page.getByLabel(/^Protein \(g\)/).fill(protein);
      await page.getByRole("button", { name: "Add to meal" }).click();
    }
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/v1/food/log") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Save meal" }).click();
    expect((await saved).status()).toBe(201);

    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByText("30 g of protein this week")).toBeVisible();
    await expect(page.getByText("About 30 g a day across the 1 day you logged.")).toBeVisible();
    await expect(page.getByRole("img", { name: /: 30 grams$/ })).toHaveCount(1);
  });

  test("a food without protein data makes the total read as 'at least'", async ({ page }) => {
    await visit(page, "/food");
    await page.getByRole("button", { name: "Add my own" }).click();
    await page.getByLabel("Food", { exact: true }).fill("Eggs");
    await page.getByLabel("Amount").fill("1");
    await page.getByLabel("In", { exact: true }).fill("plate");
    await page.getByLabel("Calories (kcal)").fill("250");
    await page.getByLabel(/^Protein \(g\)/).fill("20");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await page.getByLabel("Food", { exact: true }).fill("Mystery stew");
    await page.getByLabel("Amount").fill("1");
    await page.getByLabel("In", { exact: true }).fill("bowl");
    await page.getByLabel("Calories (kcal)").fill("300");
    await page.getByRole("button", { name: "Add to meal" }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/v1/food/log") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Save meal" }).click();
    expect((await saved).status()).toBe(201);

    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByText("At least 20 g of protein this week")).toBeVisible();
    await expect(page.getByText(/1 food has no protein data/)).toBeVisible();
  });
});
