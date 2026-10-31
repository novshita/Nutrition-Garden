import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy, SESSION_COOKIE } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

describe("proxy (signed-in check)", () => {
  it("sends visitors without a session cookie to the login page", () => {
    const response = proxy(request("/"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("lets visitors with a session cookie through", () => {
    const response = proxy(request("/", `${SESSION_COOKIE}=abc`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("ignores unrelated cookies", () => {
    expect(proxy(request("/", "theme=dark")).status).toBe(307);
  });
});

describe("proxy matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);
  it.each(["/", "/dashboard", "/garden/items"])("protects %s", (path) => {
    expect(pattern.test(path)).toBe(true);
  });
  it.each(["/login", "/register", "/api/v1/auth/me", "/_next/static/x.js", "/favicon.ico"])(
    "leaves %s alone",
    (path) => {
      expect(pattern.test(path)).toBe(false);
    },
  );
});
