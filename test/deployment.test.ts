import { describe, expect, test } from "vitest";
import {
  isCloudBrowserSessionUnavailable,
  isLocalCdpUrl,
  isLocalOnlyPagePath,
  isLocalWorkspaceHost,
  isVercelEnvironment
} from "@/lib/deployment";

describe("deployment environment helpers", () => {
  test("detects Vercel deployment", () => {
    expect(isVercelEnvironment({ VERCEL: "1" })).toBe(true);
    expect(isVercelEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isVercelEnvironment({})).toBe(false);
  });

  test("treats missing or localhost browser endpoints as local only", () => {
    expect(isLocalCdpUrl(undefined)).toBe(true);
    expect(isLocalCdpUrl("http://127.0.0.1:9222")).toBe(true);
    expect(isLocalCdpUrl("http://localhost:9222")).toBe(true);
    expect(isLocalCdpUrl("https://browser.example.com")).toBe(false);
  });

  test("blocks browser-session crawling on Vercel when endpoint is local", () => {
    expect(isCloudBrowserSessionUnavailable({ VERCEL: "1" })).toBe(true);
    expect(
      isCloudBrowserSessionUnavailable({
        VERCEL: "1",
        BROWSER_CDP_URL: "http://127.0.0.1:9222"
      })
    ).toBe(true);
    expect(
      isCloudBrowserSessionUnavailable({
        VERCEL: "1",
        BROWSER_CDP_URL: "https://browser.example.com"
      })
    ).toBe(false);
  });

  test("detects local workspace hosts for management navigation", () => {
    expect(isLocalWorkspaceHost("127.0.0.1")).toBe(true);
    expect(isLocalWorkspaceHost("localhost")).toBe(true);
    expect(isLocalWorkspaceHost("ai-video-trend.vercel.app")).toBe(false);
  });

  test("marks collection platforms and settings as local-only pages", () => {
    expect(isLocalOnlyPagePath("/")).toBe(false);
    expect(isLocalOnlyPagePath("/trends")).toBe(false);
    expect(isLocalOnlyPagePath("/collection")).toBe(true);
    expect(isLocalOnlyPagePath("/collection/items")).toBe(true);
    expect(isLocalOnlyPagePath("/platforms")).toBe(true);
    expect(isLocalOnlyPagePath("/settings")).toBe(true);
  });
});
