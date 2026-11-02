/**
 * The evening reminder is handed out once a day by the backend. The page keeps the message so it
 * stays until it's dismissed, without ever showing it twice in one day.
 */

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Saved = { date: string; message: string; dismissed: boolean };
const KEY = "ng-nudge";

function read(storage: StorageLike): Saved | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    return typeof saved.date === "string" && typeof saved.message === "string"
      ? { date: saved.date, message: saved.message, dismissed: saved.dismissed === true }
      : null;
  } catch {
    return null; // storage unavailable or corrupt: behave as if nothing was saved
  }
}

function write(storage: StorageLike, saved: Saved) {
  try {
    storage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // private windows and blocked storage are fine; the reminder just won't persist
  }
}

/** A message already received today and not yet dismissed, if any. */
export function savedNudge(storage: StorageLike, today: string): string | null {
  const saved = read(storage);
  return saved && saved.date === today && !saved.dismissed ? saved.message : null;
}

/** True when the page may ask the backend: today's reminder hasn't been received yet. */
export function shouldAsk(storage: StorageLike, today: string): boolean {
  const saved = read(storage);
  return !saved || saved.date !== today;
}

export function rememberNudge(storage: StorageLike, today: string, message: string) {
  write(storage, { date: today, message, dismissed: false });
}

export function dismissNudge(storage: StorageLike, today: string) {
  const saved = read(storage);
  write(storage, { date: today, message: saved?.message ?? "", dismissed: true });
}
