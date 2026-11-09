/** Checks for the account forms. The backend repeats every rule; these just give a quicker, kinder answer. */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 100;

export type NameChange =
  | { kind: "unchanged" }
  | { kind: "error"; error: string }
  | { kind: "change"; displayName: string };

export function buildNameChange(text: string, current: string): NameChange {
  const name = text.trim();
  if (!name) return { kind: "error", error: "Please enter a name." };
  if (name.length > MAX_NAME_LENGTH) {
    return { kind: "error", error: `Please keep it under ${MAX_NAME_LENGTH} characters.` };
  }
  return name === current.trim() ? { kind: "unchanged" } : { kind: "change", displayName: name };
}

export type PasswordForm = { current: string; next: string; confirm: string };
export type PasswordField = keyof PasswordForm;

export type PasswordResult =
  | { ok: true; payload: { current_password: string; new_password: string } }
  | { ok: false; errors: Partial<Record<PasswordField, string>> };

export function buildPasswordChange({ current, next, confirm }: PasswordForm): PasswordResult {
  const errors: Partial<Record<PasswordField, string>> = {};
  if (!current) errors.current = "Please enter your current password.";
  if (next.length < MIN_PASSWORD_LENGTH) {
    errors.next = `Please choose at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (next.length > MAX_PASSWORD_LENGTH) {
    errors.next = `Please keep it under ${MAX_PASSWORD_LENGTH} characters.`;
  } else if (current && next === current) {
    errors.next = "Please choose something different from your current password.";
  }
  if (!errors.next && confirm !== next) errors.confirm = "The two new passwords don't match.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, payload: { current_password: current, new_password: next } };
}

export function buildDeleteRequest(
  password: string,
): { ok: true; payload: { password: string } } | { ok: false; error: string } {
  if (!password) return { ok: false, error: "Please enter your password to confirm." };
  return { ok: true, payload: { password } };
}
