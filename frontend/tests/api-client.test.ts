import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, messageFromDetail } from "@/lib/api/client";

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("calls the /api/v1 path with same-origin credentials and returns the JSON", async () => {
    const fetchMock = mockFetch(json({ id: "1", display_name: "Rose" }));
    const result = await api<{ display_name: string }>("/auth/me");
    expect(result.display_name).toBe("Rose");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBeUndefined();
  });

  it("sends a JSON body with the right header", async () => {
    const fetchMock = mockFetch(json({}, 201));
    await api("/auth/register", { method: "POST", body: { email: "a@b.co" } });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "a@b.co" }));
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("returns undefined for 204 responses", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(api<void>("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the status and the backend's message", async () => {
    mockFetch(json({ detail: "Invalid email or password" }, 401));
    const error = await api("/auth/login", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("Invalid email or password");
  });

  it("turns validation errors into one readable line", async () => {
    mockFetch(
      json({ detail: [{ loc: ["body", "password"], msg: "String should have at least 8 characters" }] }, 422),
    );
    const error = (await api("/auth/register", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(422);
    expect(error.message).toBe("password: String should have at least 8 characters");
  });

  it("falls back to a friendly message when the error body isn't JSON", async () => {
    mockFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = (await api("/garden").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(error.message).not.toContain("html");
  });

  it("reports an unreachable server as status 0 without leaking details", async () => {
    mockFetch(new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:8000"));
    const error = (await api("/garden").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toContain("couldn't reach the garden");
    expect(error.message).not.toContain("ECONNREFUSED");
  });

  it("lets an aborted request through as an abort, not an API error", async () => {
    mockFetch(new DOMException("aborted", "AbortError"));
    const error = await api("/garden").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe("messageFromDetail", () => {
  it("uses string details as they are", () => {
    expect(messageFromDetail("Email is already registered")).toBe("Email is already registered");
  });

  it("names the field, with underscores turned into spaces", () => {
    expect(messageFromDetail([{ loc: ["body", "display_name"], msg: "Field required" }])).toBe(
      "display name: Field required",
    );
  });

  it("drops pydantic's 'Value error, ' prefix and a bare 'body' location", () => {
    expect(messageFromDetail([{ loc: ["body"], msg: "Value error, Choose a workout" }])).toBe(
      "Choose a workout",
    );
  });

  it("is generic for anything unrecognised", () => {
    for (const detail of [undefined, null, 42, [], [{}], "  "]) {
      expect(messageFromDetail(detail)).toBe("Something went wrong. Please try again.");
    }
  });
});
