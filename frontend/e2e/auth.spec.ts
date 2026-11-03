import { expect, test } from "@playwright/test";
import { PASSWORD, newEmail, register, signUpAndOnboard, visit } from "./helpers";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  for (const path of ["/", "/food", "/weight", "/settings"]) {
    await visit(page, path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("a short password is refused before anything is sent", async ({ page }) => {
  await visit(page, "/register");
  await page.getByLabel("What should we call you?").fill("Rosie");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create my garden" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "at least 8 characters" })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("registering leads to onboarding, then the dashboard", async ({ page }) => {
  await register(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a wrong password is refused with a calm message", async ({ page }) => {
  const email = await register(page);
  await page.context().clearCookies();
  await visit(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("sign out ends the session; signing in again returns to the dashboard", async ({ page }) => {
  const email = await signUpAndOnboard(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await visit(page, "/food");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();
});

test("the session survives a reload", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();
});
