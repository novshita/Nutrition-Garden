import { describe, expect, it } from "vitest";
import { buildNameChange, buildPasswordChange, MIN_PASSWORD_LENGTH } from "@/lib/account";

describe("buildNameChange", () => {
  it("trims and reports a real change", () => {
    expect(buildNameChange("  Rosie ", "Rose")).toEqual({ kind: "change", displayName: "Rosie" });
  });
  it("sends nothing when the name is the same, ignoring spaces", () => {
    expect(buildNameChange(" Rose ", "Rose")).toEqual({ kind: "unchanged" });
  });
  it("refuses a blank name", () => {
    expect(buildNameChange("   ", "Rose").kind).toBe("error");
  });
  it("refuses a name over 100 characters but allows exactly 100", () => {
    expect(buildNameChange("x".repeat(101), "Rose").kind).toBe("error");
    expect(buildNameChange("x".repeat(100), "Rose").kind).toBe("change");
  });
});

describe("buildPasswordChange", () => {
  const good = { current: "old-password", next: "new-password-1", confirm: "new-password-1" };

  it("builds the payload the backend expects", () => {
    expect(buildPasswordChange(good)).toEqual({
      ok: true,
      payload: { current_password: "old-password", new_password: "new-password-1" },
    });
  });
  it("asks for the current password", () => {
    const result = buildPasswordChange({ ...good, current: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.current).toBeTruthy();
  });
  it("needs a new password of at least the minimum length", () => {
    const result = buildPasswordChange({ ...good, next: "x".repeat(MIN_PASSWORD_LENGTH - 1), confirm: "x".repeat(MIN_PASSWORD_LENGTH - 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.next).toBeTruthy();
    expect(buildPasswordChange({ ...good, next: "x".repeat(MIN_PASSWORD_LENGTH), confirm: "x".repeat(MIN_PASSWORD_LENGTH) }).ok).toBe(true);
  });
  it("refuses a new password over 128 characters", () => {
    const long = "x".repeat(129);
    expect(buildPasswordChange({ ...good, next: long, confirm: long }).ok).toBe(false);
  });
  it("refuses reusing the current password", () => {
    const result = buildPasswordChange({ current: "same-password", next: "same-password", confirm: "same-password" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.next).toMatch(/different/);
  });
  it("needs the confirmation to match", () => {
    const result = buildPasswordChange({ ...good, confirm: "something-else" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.confirm).toBeTruthy();
  });
  it("reports every problem at once", () => {
    const result = buildPasswordChange({ current: "", next: "x", confirm: "y" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["current", "next"]);
  });
});

import { buildDeleteRequest } from "@/lib/account";

describe("buildDeleteRequest", () => {
  it("needs the password", () => {
    expect(buildDeleteRequest("").ok).toBe(false);
  });
  it("sends the password exactly as typed", () => {
    expect(buildDeleteRequest(" spaced password ")).toEqual({ ok: true, payload: { password: " spaced password " } });
  });
});
