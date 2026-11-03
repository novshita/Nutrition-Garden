import { expect, type Page } from "@playwright/test";

/** Open a page and wait until React has taken over, so typed text isn't wiped by hydration. */
export async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

export const PASSWORD = "correct-horse-battery";

/** A fresh email per test, so tests never depend on each other. */
export const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export async function register(page: Page, email = newEmail(), name = "Rosie") {
  await visit(page, "/register");
  await page.getByLabel("What should we call you?").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my garden" }).click();
  await expect(page.getByText("Let's get to know you")).toBeVisible();
  return email;
}

/** Metric onboarding with a 28-year-old woman: 165 cm, 52 kg, aiming for 58 kg. */
export async function onboard(page: Page) {
  await page.getByLabel("Date of birth").fill("1997-05-14");
  await page.getByLabel("Sex").selectOption("FEMALE");
  await page.getByLabel("Height (cm)").fill("165");
  await page.getByLabel("Current weight (kg)").fill("52");
  await page.getByLabel("Goal weight (kg)").fill("58");
  await page.getByLabel("Usual activity level").selectOption("LIGHT");
  await page.getByRole("button", { name: "Plant my garden" }).click();
  await expect(page.getByText(/Your garden is planted/)).toBeVisible();
  await page.getByRole("button", { name: "Go to my garden" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();
}

export async function signUpAndOnboard(page: Page) {
  const email = await register(page);
  await onboard(page);
  return email;
}
