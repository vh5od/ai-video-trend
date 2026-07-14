import { describe, expect, test } from "vitest";
import { isAdminAuthorized, isProtectedRoute } from "@/lib/auth";

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://example.com${path}`, init);
}

function basic(password: string) {
  return `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
}

describe("admin route protection", () => {
  test("keeps dashboards public and protects management pages", () => {
    expect(isProtectedRoute(request("/"))).toBe(false);
    expect(isProtectedRoute(request("/trends"))).toBe(false);
    expect(isProtectedRoute(request("/trends/trend_ai"))).toBe(false);
    expect(isProtectedRoute(request("/settings"))).toBe(true);
    expect(isProtectedRoute(request("/collection"))).toBe(true);
  });

  test("protects write APIs while keeping read-only trend data public", () => {
    expect(isProtectedRoute(request("/api/trends"))).toBe(false);
    expect(isProtectedRoute(request("/api/trends/trend_ai"))).toBe(false);
    expect(isProtectedRoute(request("/api/sources"))).toBe(false);
    expect(isProtectedRoute(request("/api/sources", { method: "POST" }))).toBe(true);
    expect(isProtectedRoute(request("/api/crawl/daily", { method: "POST" }))).toBe(true);
    expect(isProtectedRoute(request("/api/collection/candidates"))).toBe(true);
    expect(isProtectedRoute(request("/api/thumbnail-repairs"))).toBe(true);
    expect(isProtectedRoute(request("/api/thumbnail-repairs/report", { method: "POST" }))).toBe(false);
  });

  test("authorizes basic auth only when password matches", () => {
    expect(isAdminAuthorized(request("/settings"), { ADMIN_PASSWORD: "secret" })).toBe(false);
    expect(
      isAdminAuthorized(
        request("/settings", { headers: { authorization: basic("wrong") } }),
        { ADMIN_PASSWORD: "secret" }
      )
    ).toBe(false);
    expect(
      isAdminAuthorized(
        request("/settings", { headers: { authorization: basic("secret") } }),
        { ADMIN_PASSWORD: "secret" }
      )
    ).toBe(true);
  });

  test("does not lock local development when ADMIN_PASSWORD is absent", () => {
    expect(isAdminAuthorized(request("/settings"), {})).toBe(true);
  });
});
