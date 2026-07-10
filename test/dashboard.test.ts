import { describe, expect, it } from "vitest";
import {
  DASHBOARD_STATE_STORAGE_KEY,
  buildFollowUpCandidates,
  buildTimeWindowTrendSummaries,
  dashboardStateFromStorage,
  dashboardStateToStorage,
  filterSourcesByDashboard,
  getDashboardTimeWindow,
  sortDashboardSources,
  sourceHeatScore
} from "@/lib/dashboard";
import type { SourceItem, TrendTopic } from "@/lib/types";

const now = new Date("2026-07-09T12:00:00.000Z");

function source(overrides: Partial<SourceItem>): SourceItem {
  return {
    id: "src_default",
    platform: "tiktok",
    externalId: "external",
    url: "https://example.com/video",
    authorName: "Creator",
    authorHandle: "creator",
    title: "AI prompt workflow",
    text: "AI prompt workflow",
    hashtags: ["ai"],
    language: "en",
    region: "US",
    mediaType: "video",
    publishedAt: "2026-07-09T09:00:00.000Z",
    collectedAt: "2026-07-09T10:00:00.000Z",
    metrics: { views: 1000, likes: 100, comments: 10, shares: 5 },
    raw: {},
    seeded: false,
    ...overrides
  };
}

function trend(overrides: Partial<TrendTopic>): TrendTopic {
  return {
    id: "trend_ai",
    title: "AI prompt workflow",
    summary: "Prompt workflow trend",
    keywords: ["prompt", "workflow"],
    heatScore: 80,
    status: "hot",
    firstSeenAt: "2026-07-09T08:00:00.000Z",
    lastSeenAt: "2026-07-09T11:00:00.000Z",
    sourceCount: 2,
    platformBreakdown: { instagram: 1, tiktok: 1, x: 0 },
    scoreBreakdown: { engagement: 1, freshness: 1, keywordRelevance: 1, sourceCount: 2 },
    sourceIds: ["tiktok_hot", "ig_hot"],
    ...overrides
  };
}

describe("dashboard helpers", () => {
  it("filters sources by publishedAt and platform", () => {
    const window = getDashboardTimeWindow("today", now);
    const sources = [
      source({ id: "today_tiktok", platform: "tiktok" }),
      source({ id: "today_ig", platform: "instagram" }),
      source({
        id: "old_published",
        publishedAt: "2026-07-01T10:00:00.000Z",
        collectedAt: "2026-07-09T10:00:00.000Z"
      })
    ];

    expect(filterSourcesByDashboard(sources, { window, platform: "all" }).map((item) => item.id))
      .toEqual(["today_tiktok", "today_ig"]);
    expect(filterSourcesByDashboard(sources, { window, platform: "tiktok" }).map((item) => item.id))
      .toEqual(["today_tiktok"]);
  });

  it("uses half-open time windows and keeps all scoped to Instagram and TikTok", () => {
    const today = getDashboardTimeWindow("today", now);
    const yesterday = getDashboardTimeWindow("yesterday", now);
    const midnight = source({
      id: "midnight",
      platform: "instagram",
      publishedAt: today.start.toISOString()
    });
    const xSource = source({
      id: "x_source",
      platform: "x",
      publishedAt: "2026-07-09T10:00:00.000Z"
    });

    expect(filterSourcesByDashboard([midnight], { window: today, platform: "all" }).map((item) => item.id))
      .toEqual(["midnight"]);
    expect(filterSourcesByDashboard([midnight], { window: yesterday, platform: "all" }))
      .toEqual([]);
    expect(filterSourcesByDashboard([xSource], { window: today, platform: "all" }))
      .toEqual([]);
  });

  it("includes the full custom end day with a half-open next-day boundary", () => {
    const window = getDashboardTimeWindow("custom", now, {
      start: new Date("2026-07-09T00:00:00.000Z"),
      end: new Date("2026-07-10T00:00:00.000Z")
    });
    const late = source({ id: "late", publishedAt: "2026-07-09T23:59:59.500Z" });
    const nextDay = source({ id: "next_day", publishedAt: "2026-07-10T00:00:00.000Z" });

    expect(filterSourcesByDashboard([late, nextDay], { window, platform: "all" }).map((item) => item.id))
      .toEqual(["late"]);
  });

  it("sorts sources by derived heat score", () => {
    const low = source({ id: "low", metrics: { views: 100, likes: 1 } });
    const high = source({ id: "high", metrics: { views: 100, likes: 1, shares: 100 } });

    expect(sourceHeatScore(high)).toBeGreaterThan(sourceHeatScore(low));
    expect(sortDashboardSources([low, high], "heat").map((item) => item.id)).toEqual(["high", "low"]);
  });

  it("sorts latest sources without NaN from invalid dates or missing metrics", () => {
    const invalid = source({ id: "invalid", publishedAt: "not-a-date", metrics: {} });
    const valid = source({ id: "valid", publishedAt: "2026-07-09T11:00:00.000Z", metrics: {} });

    expect(sourceHeatScore(invalid)).toBe(0);
    expect(sortDashboardSources([invalid, valid], "latest").map((item) => item.id))
      .toEqual(["valid", "invalid"]);
  });

  it("sorts sources by collected time explicitly", () => {
    const old = source({ id: "old", collectedAt: "2026-07-09T09:00:00.000Z" });
    const fresh = source({ id: "fresh", collectedAt: "2026-07-09T11:00:00.000Z" });

    expect(sortDashboardSources([old, fresh], "collected").map((item) => item.id))
      .toEqual(["fresh", "old"]);
  });

  it("round-trips dashboard control state for persistence", () => {
    const state = {
      timePreset: "this_week" as const,
      platform: "tiktok" as const,
      sortKey: "heat" as const,
      customStart: "2026-07-01",
      customEnd: "2026-07-09"
    };

    expect(DASHBOARD_STATE_STORAGE_KEY).toBe("ai-video-trend-dashboard-state");
    expect(dashboardStateFromStorage(dashboardStateToStorage(state))).toEqual(state);
    expect(dashboardStateFromStorage("{bad json")).toBeUndefined();
  });

  it("builds time-window trend summaries from filtered sources", () => {
    const tiktok = source({ id: "tiktok_hot", platform: "tiktok" });
    const oldIg = source({ id: "ig_hot", platform: "instagram", publishedAt: "2026-07-01T10:00:00.000Z" });
    const window = getDashboardTimeWindow("today", now);
    const filtered = filterSourcesByDashboard([tiktok, oldIg], { window, platform: "all" });

    const summaries = buildTimeWindowTrendSummaries([trend({})], filtered);

    expect(summaries[0].filteredSourceCount).toBe(1);
    expect(summaries[0].platformBreakdown.tiktok).toBe(1);
    expect(summaries[0].platformBreakdown.instagram).toBe(0);
  });

  it("explains follow-up candidates", () => {
    const hot = source({
      id: "tiktok_hot",
      platform: "tiktok",
      metrics: { views: 200000, likes: 10000, comments: 800, shares: 1500 },
      thumbnailUrl: "/thumbnail.jpg"
    });

    const candidates = buildFollowUpCandidates([hot], [trend({})]);

    expect(candidates[0].reasons.length).toBeGreaterThan(0);
    expect(candidates[0].reasons.join(" ")).toContain("TikTok");
  });
});
