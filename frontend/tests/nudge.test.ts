import { describe, expect, it } from "vitest";
import { dismissNudge, rememberNudge, savedNudge, shouldAsk } from "@/lib/nudge";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const TODAY = "2026-03-10";

describe("evening reminder storage", () => {
  it("asks the backend when nothing has been received today", () => {
    expect(shouldAsk(memoryStorage(), TODAY)).toBe(true);
  });

  it("keeps a received message until it's dismissed, without asking again", () => {
    const storage = memoryStorage();
    rememberNudge(storage, TODAY, "You still have some room left.");
    expect(savedNudge(storage, TODAY)).toBe("You still have some room left.");
    expect(shouldAsk(storage, TODAY)).toBe(false);
  });

  it("stays dismissed for the rest of the day", () => {
    const storage = memoryStorage();
    rememberNudge(storage, TODAY, "Hello");
    dismissNudge(storage, TODAY);
    expect(savedNudge(storage, TODAY)).toBeNull();
    expect(shouldAsk(storage, TODAY)).toBe(false); // the backend won't give another today
  });

  it("starts fresh on a new day", () => {
    const storage = memoryStorage();
    rememberNudge(storage, TODAY, "Hello");
    dismissNudge(storage, TODAY);
    expect(shouldAsk(storage, "2026-03-11")).toBe(true);
    expect(savedNudge(storage, "2026-03-11")).toBeNull();
  });

  it("copes with corrupt or unavailable storage", () => {
    expect(savedNudge(memoryStorage({ "ng-nudge": "not json" }), TODAY)).toBeNull();
    expect(shouldAsk(memoryStorage({ "ng-nudge": "{}" }), TODAY)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(savedNudge(broken, TODAY)).toBeNull();
    expect(shouldAsk(broken, TODAY)).toBe(true);
    expect(() => rememberNudge(broken, TODAY, "x")).not.toThrow();
    expect(() => dismissNudge(broken, TODAY)).not.toThrow();
  });
});
