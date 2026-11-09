import { expect, test } from "@playwright/test";
import { PASSWORD, newEmail, onboard, register, signUpAndOnboard, visit } from "./helpers";

const NEW_PASSWORD = "a-brand-new-password";

async function fillPasswordForm(page: import("@playwright/test").Page, current: string, next: string, confirm = next) {
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("New password again").fill(confirm);
  await page.getByRole("button", { name: "Change password" }).click();
}

test.describe("account settings", () => {
  test("the display name can be changed and shows on the dashboard", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await page.getByLabel("What should we call you?").fill("Rosie-Lee");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name saved")).toBeVisible();
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "Hello, Rosie-Lee" })).toBeVisible();
  });

  test("a blank name is refused and an unchanged name sends nothing", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Nothing to change.")).toBeVisible();
    await page.getByLabel("What should we call you?").fill("   ");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Please enter a name.")).toBeVisible();
  });

  test("password form checks are quick and kind", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD, "something-else");
    await expect(page.getByText("The two new passwords don't match.")).toBeVisible();
    await fillPasswordForm(page, PASSWORD, "short");
    await expect(page.getByText("Please choose at least 8 characters.")).toBeVisible();
  });

  test("a wrong current password is refused and you stay signed in", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await fillPasswordForm(page, "not-my-password", NEW_PASSWORD);
    await expect(page.getByText("Your current password isn't right.")).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  });

  test("changing the password works, and the old one stops working", async ({ page }) => {
    const email = await signUpAndOnboard(page);
    await visit(page, "/settings");
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();
  });

  test("changing the password signs out other devices but not this one", async ({ page, browser }) => {
    const email = await signUpAndOnboard(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await visit(otherPage, "/login");
    await otherPage.getByLabel("Email").fill(email);
    await otherPage.getByLabel("Password").fill(PASSWORD);
    await otherPage.getByRole("button", { name: "Sign in" }).click();
    await expect(otherPage.getByRole("heading", { name: "Hello, Rosie" })).toBeVisible();

    await visit(page, "/settings");
    await fillPasswordForm(page, PASSWORD, NEW_PASSWORD);
    await expect(page.getByText("Password changed")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();

    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login$/);
    await other.close();
  });
});

test("too many wrong passwords slows sign-in down, calmly", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();
  await visit(page, "/login");
  await page.getByLabel("Email").fill(email);
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.getByLabel("Password").fill(`wrong-password-${attempt}`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  }
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Too many attempts.*wait about 15 minutes/ })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("deleting the account", () => {
  test("it asks first, and 'keep my account' backs out", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    await expect(page.getByText(/It can't be undone/)).toBeVisible();
    await page.getByRole("button", { name: "Keep my account" }).click();
    await expect(page.getByRole("button", { name: "Delete my account…" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  });

  test("a missing or wrong password deletes nothing", async ({ page }) => {
    await signUpAndOnboard(page);
    await visit(page, "/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    await page.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page.getByText("Please enter your password to confirm.")).toBeVisible();
    await page.getByLabel("Your password").fill("not-my-password");
    await page.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page.getByText("That password isn't right.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  });

  test("with the right password the account is erased and cannot be used again", async ({ page }) => {
    const email = await signUpAndOnboard(page);
    await visit(page, "/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await visit(page, "/food");
    await expect(page).toHaveURL(/\/login$/); // no session any more

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  });

  test("the same email can start over with a clean garden", async ({ page }) => {
    const email = await signUpAndOnboard(page);
    await visit(page, "/weight");
    await page.getByLabel("Weight (kg)").fill("52.4");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByText("52.4 kg").first()).toBeVisible();

    await visit(page, "/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await register(page, email);
    await onboard(page);
    await visit(page, "/weight");
    await expect(page.getByText("52.4 kg")).toHaveCount(0);
  });
});
