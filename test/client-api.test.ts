import { describe, expect, test } from "vitest";
import { apiUrl } from "@/lib/client-api";

describe("client API URL builder", () => {
  test("keeps server-side and absolute URLs unchanged", () => {
    expect(apiUrl("/api/settings", undefined)).toBe("/api/settings");
    expect(apiUrl("https://example.com/api/settings")).toBe(
      "https://example.com/api/settings"
    );
  });

  test("drops URL credentials when building browser API URLs", () => {
    expect(
      apiUrl("/api/settings", {
        protocol: "https:",
        host: "ai-video-trend.vercel.app"
      })
    ).toBe("https://ai-video-trend.vercel.app/api/settings");
  });
});
