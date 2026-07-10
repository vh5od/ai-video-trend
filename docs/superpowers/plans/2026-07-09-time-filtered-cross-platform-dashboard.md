# Time-Filtered Cross-Platform Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard so the first view ranks TikTok and Instagram source items collected in a selected time window, shows which trends those items support, and surfaces rule-based follow-up/recreation candidates.

**Architecture:** Keep storage and APIs unchanged. Add pure dashboard derivation helpers over `SourceItem[]` and `TrendTopic[]`, then consume those helpers in the dashboard and trend detail UI.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind CSS, Vitest.

---

## Git Note

The current workspace is not a git repository root, so this plan omits commit commands. If a git repository is restored later, commit after each completed task.

## File Structure

```text
lib/
  dashboard.ts                 # New pure helpers for time filters, ranking, trend joins, follow-up reasons
  types.ts                     # Existing shared types, no schema change expected
components/
  DashboardControls.tsx         # New compact controls for time/platform/sort
  SourceLeaderboard.tsx         # New primary ranked source view
  TimeWindowTrendMap.tsx        # New trend summary view scoped to filtered sources
  FollowUpCandidates.tsx        # New rule-based follow-up list
  TrendTable.tsx                # Add TikTok column and neutral empty copy
  Badge.tsx                     # Optional platform tone polish
app/
  page.tsx                     # Rebuilt dashboard composition
  trends/[id]/page.tsx          # Cross-platform trend detail copy/filter/metrics
test/
  dashboard.test.ts             # New focused helper tests
```

## Task 1: Add Dashboard Helper Test Skeleton

- [ ] Create `test/dashboard.test.ts`.
- [ ] Cover time preset filtering, platform filtering, heat sorting, trend joining, and follow-up reasons.
- [ ] Use deterministic `now = new Date("2026-07-09T12:00:00.000Z")`.
- [ ] Run the focused test and confirm it fails because `@/lib/dashboard` does not exist yet.

Test starter:

```ts
import { describe, expect, it } from "vitest";
import {
  buildFollowUpCandidates,
  buildTimeWindowTrendSummaries,
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
```

Required assertions:

```ts
it("filters sources by collectedAt and platform", () => {
  const window = getDashboardTimeWindow("today", now);
  const sources = [
    source({ id: "today_tiktok", platform: "tiktok" }),
    source({ id: "today_ig", platform: "instagram" }),
    source({ id: "old", collectedAt: "2026-07-01T10:00:00.000Z" })
  ];

  expect(filterSourcesByDashboard(sources, { window, platform: "all" }).map((item) => item.id))
    .toEqual(["today_tiktok", "today_ig"]);
  expect(filterSourcesByDashboard(sources, { window, platform: "tiktok" }).map((item) => item.id))
    .toEqual(["today_tiktok"]);
});

it("sorts sources by derived heat score", () => {
  const low = source({ id: "low", metrics: { views: 100, likes: 1 } });
  const high = source({ id: "high", metrics: { views: 100, likes: 1, shares: 100 } });

  expect(sourceHeatScore(high)).toBeGreaterThan(sourceHeatScore(low));
  expect(sortDashboardSources([low, high], "heat").map((item) => item.id)).toEqual(["high", "low"]);
});
```

Command:

```powershell
npm.cmd test -- test/dashboard.test.ts
```

Expected result: Vitest fails with a missing `lib/dashboard` module.

## Task 2: Implement Dashboard Data Helpers

- [ ] Add `lib/dashboard.ts`.
- [ ] Export these types and functions:
  - `DashboardTimePreset`
  - `DashboardPlatformFilter`
  - `DashboardSortKey`
  - `DashboardTimeWindow`
  - `getDashboardTimeWindow`
  - `sourceHeatScore`
  - `filterSourcesByDashboard`
  - `sortDashboardSources`
  - `buildTimeWindowTrendSummaries`
  - `buildFollowUpCandidates`
  - `formatCompactNumber`
- [ ] Keep all logic pure and independent of React.
- [ ] Treat missing metrics as zero for sorting, but leave display handling to components.

Implementation shape:

```ts
import type { Platform, SourceItem, TrendTopic } from "@/lib/types";

export type DashboardTimePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export type DashboardPlatformFilter = "all" | Extract<Platform, "instagram" | "tiktok">;
export type DashboardSortKey = "heat" | "latest" | "likes" | "comments" | "shares";

export interface DashboardTimeWindow {
  preset: DashboardTimePreset;
  label: string;
  start: Date;
  end: Date;
}

export function sourceHeatScore(source: SourceItem) {
  const metrics = source.metrics ?? {};
  return (
    (metrics.views ?? 0) +
    (metrics.likes ?? 0) * 8 +
    (metrics.comments ?? 0) * 20 +
    (metrics.shares ?? 0) * 30
  );
}
```

Time-window behavior:

- `today`: local start of current day through now.
- `yesterday`: previous local day.
- `this_week`: Monday 00:00 through now.
- `last_week`: previous Monday 00:00 through current Monday 00:00.
- `last_7_days`: now minus 7 days through now.
- `last_30_days`: now minus 30 days through now.
- `custom`: use supplied start/end dates.

Trend summary interface:

```ts
export interface TimeWindowTrendSummary {
  trend: TrendTopic;
  filteredSources: SourceItem[];
  filteredSourceCount: number;
  platformBreakdown: Record<Platform, number>;
  representative?: SourceItem;
}
```

Follow-up candidate interface:

```ts
export interface FollowUpCandidate {
  source: SourceItem;
  trend?: TrendTopic;
  score: number;
  reasons: string[];
}
```

Command:

```powershell
npm.cmd test -- test/dashboard.test.ts
```

Expected result: new helper tests pass.

## Task 3: Complete Helper Coverage for Trend Summaries and Follow-Up Reasons

- [ ] Extend `test/dashboard.test.ts` with trend join and follow-up assertions.
- [ ] Verify trend summaries only count filtered source ids.
- [ ] Verify candidates include explainable reasons.

Test additions:

```ts
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

it("builds time-window trend summaries from filtered sources", () => {
  const tiktok = source({ id: "tiktok_hot", platform: "tiktok" });
  const oldIg = source({ id: "ig_hot", platform: "instagram", collectedAt: "2026-07-01T10:00:00.000Z" });
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
```

Command:

```powershell
npm.cmd test -- test/dashboard.test.ts
```

Expected result: all dashboard helper tests pass.

## Task 4: Add Dashboard UI Components

- [ ] Create `components/DashboardControls.tsx`.
- [ ] Create `components/SourceLeaderboard.tsx`.
- [ ] Create `components/TimeWindowTrendMap.tsx`.
- [ ] Create `components/FollowUpCandidates.tsx`.
- [ ] Keep the page utilitarian and scan-friendly: compact controls, tables/lists, no landing-page hero.
- [ ] Use visible copy that reflects the user's priorities: time window, platform, ranking, trends, follow-up.

Control props:

```ts
import type {
  DashboardPlatformFilter,
  DashboardSortKey,
  DashboardTimePreset
} from "@/lib/dashboard";

interface DashboardControlsProps {
  timePreset: DashboardTimePreset;
  platform: DashboardPlatformFilter;
  sortKey: DashboardSortKey;
  customStart: string;
  customEnd: string;
  onTimePresetChange: (value: DashboardTimePreset) => void;
  onPlatformChange: (value: DashboardPlatformFilter) => void;
  onSortKeyChange: (value: DashboardSortKey) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}
```

Source leaderboard requirements:

- Rank by the current sort.
- Show preview or stable platform fallback.
- Show platform badge, author, handle, caption/title.
- Show views, likes, comments, shares, derived heat.
- Show published and collected dates.
- Link to source URL.
- Link associated trend titles if present.
- Display `-` for unavailable metric values.

Trend map requirements:

- Show only trends with filtered source evidence.
- Include TikTok, Instagram, X counts in the selected time window.
- Show representative source preview.
- Link to trend detail.

Follow-up list requirements:

- Show top 8 candidates.
- Include reasons, platform, author, source heat, and source/trend links.

Command:

```powershell
npx.cmd tsc --noEmit
```

Expected result: new components type-check once wired in later tasks.

## Task 5: Rebuild Dashboard Page Composition

- [ ] Update `app/page.tsx` to import helper functions and new components.
- [ ] Add state for:
  - `timePreset`, default `"this_week"`.
  - `platform`, default `"all"`.
  - `sortKey`, default `"heat"`.
  - custom start/end date strings.
- [ ] Fetch `/api/trends` and `/api/sources` as it does today.
- [ ] Derive:
  - `timeWindow`
  - `filteredSources`
  - `rankedSources`
  - `trendSummaries`
  - `followUpCandidates`
  - selected-window stats
- [ ] Replace Instagram-first header and metrics.

Dashboard derivation shape:

```tsx
const timeWindow = getDashboardTimeWindow(timePreset, new Date(), {
  start: customStart ? new Date(`${customStart}T00:00:00`) : undefined,
  end: customEnd ? new Date(`${customEnd}T23:59:59`) : undefined
});

const filteredSources = filterSourcesByDashboard(sources, {
  window: timeWindow,
  platform
});

const rankedSources = sortDashboardSources(filteredSources, sortKey);
const trendSummaries = buildTimeWindowTrendSummaries(trends, filteredSources);
const followUpCandidates = buildFollowUpCandidates(filteredSources, trends);
```

Metrics to display:

- TikTok sources in selected time window.
- Instagram sources in selected time window.
- Total engagement in selected time window.
- Trend topics with filtered evidence.
- Follow-up candidates.

Command:

```powershell
npx.cmd tsc --noEmit
```

Expected result: TypeScript passes.

## Task 6: Update Existing Trend Table Copy and TikTok Visibility

- [ ] Update `components/TrendTable.tsx`.
- [ ] Add `TikTok Sources` column between Instagram and X.
- [ ] Change empty copy to platform-neutral wording.
- [ ] Ensure column span matches the new column count.

Patch shape:

```tsx
<th className="px-3 py-2">Instagram Sources</th>
<th className="px-3 py-2">TikTok Sources</th>
<th className="px-3 py-2">X Sources</th>
```

```tsx
<td className="px-3 py-3">{trend.platformBreakdown.instagram ?? 0}</td>
<td className="px-3 py-3">{trend.platformBreakdown.tiktok ?? 0}</td>
<td className="px-3 py-3">{trend.platformBreakdown.x ?? 0}</td>
```

Command:

```powershell
npx.cmd tsc --noEmit
```

Expected result: TypeScript passes.

## Task 7: Make Trend Detail Page Cross-Platform

- [ ] Update `app/trends/[id]/page.tsx`.
- [ ] Replace Instagram-specific copy:
  - `Open Instagram source` becomes `Open source`.
  - Ranking description references cross-platform engagement and recency.
- [ ] Add platform filter state for evidence: `all`, `instagram`, `tiktok`, `x`.
- [ ] Add platform metric totals by evidence source.
- [ ] Add compact follow-up notes using `buildFollowUpCandidates(evidence, [trend])`.

Detail derivation shape:

```tsx
const platformTotals = evidence.reduce(
  (totals, source) => {
    const bucket = totals[source.platform];
    bucket.sources += 1;
    bucket.views += source.metrics.views ?? 0;
    bucket.likes += source.metrics.likes ?? 0;
    bucket.comments += source.metrics.comments ?? 0;
    bucket.shares += source.metrics.shares ?? 0;
    return totals;
  },
  {
    instagram: { sources: 0, views: 0, likes: 0, comments: 0, shares: 0 },
    tiktok: { sources: 0, views: 0, likes: 0, comments: 0, shares: 0 },
    x: { sources: 0, views: 0, likes: 0, comments: 0, shares: 0 }
  }
);
```

Command:

```powershell
npx.cmd tsc --noEmit
```

Expected result: TypeScript passes.

## Task 8: Polish Platform Badges and Empty States

- [ ] Update `components/Badge.tsx` only if platform tones are not already distinct enough.
- [ ] Ensure `instagram`, `tiktok`, and `x` are readable as badge tones.
- [ ] Add neutral empty states:
  - No sources in time window.
  - No trends linked to filtered sources.
  - No follow-up candidates yet.
- [ ] Confirm missing metrics display as `-` in UI rows, not `0`.

Command:

```powershell
npx.cmd tsc --noEmit
```

Expected result: TypeScript passes.

## Task 9: Full Verification

- [ ] Run all tests.
- [ ] Run TypeScript check.
- [ ] Run production build.
- [ ] If the dev server is already running on `3001`, use the in-app browser to inspect `http://127.0.0.1:3001/`.
- [ ] If no dev server is running, start it on an available port and inspect the dashboard.

Commands:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

Expected result:

- Vitest passes.
- TypeScript emits no errors.
- Next.js build completes.
- Dashboard shows a default `This week` view with TikTok and Instagram source rankings.
- Time presets change the source leaderboard, trend map, and follow-up list together.

## Self-Review Checklist

- [ ] Spec coverage: The plan implements selected-time-window source ranking, cross-platform trend summaries, follow-up candidates, and a cross-platform trend detail page.
- [ ] Time coverage: The plan includes `Today`, `Yesterday`, `This week`, `Last week`, `Last 7 days`, `Last 30 days`, and `Custom range`.
- [ ] Data-model restraint: The plan does not add database or JSON schema changes.
- [ ] Type consistency: The plan uses existing `SourceItem`, `TrendTopic`, `Platform`, and metrics fields.
- [ ] Open-item scan: The plan contains no unresolved markers or vague file targets.
- [ ] Verification: The plan ends with tests, TypeScript, build, and browser inspection.
