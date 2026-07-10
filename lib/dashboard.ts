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
export type DashboardSortKey =
  | "heat"
  | "latest"
  | "collected"
  | "likes"
  | "comments"
  | "shares";

export const DASHBOARD_STATE_STORAGE_KEY = "ai-video-trend-dashboard-state";

export interface DashboardPersistedState {
  timePreset: DashboardTimePreset;
  platform: DashboardPlatformFilter;
  sortKey: DashboardSortKey;
  customStart: string;
  customEnd: string;
}

export interface DashboardTimeWindow {
  preset: DashboardTimePreset;
  label: string;
  start: Date;
  end: Date;
}

export interface TimeWindowTrendSummary {
  trend: TrendTopic;
  filteredSources: SourceItem[];
  filteredSourceCount: number;
  platformBreakdown: Record<Platform, number>;
  representative?: SourceItem;
}

export interface FollowUpCandidate {
  source: SourceItem;
  trend?: TrendTopic;
  score: number;
  reasons: string[];
}

export function getDashboardTimeWindow(
  preset: DashboardTimePreset,
  now = new Date(),
  custom?: { start?: Date; end?: Date }
): DashboardTimeWindow {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  if (preset === "today") {
    return { preset, label: "Today", start: todayStart, end: now };
  }

  if (preset === "yesterday") {
    const start = addDays(todayStart, -1);
    return { preset, label: "Yesterday", start, end: todayStart };
  }

  if (preset === "this_week") {
    return { preset, label: "This week", start: startOfWeek(now), end: now };
  }

  if (preset === "last_week") {
    const thisWeekStart = startOfWeek(now);
    return { preset, label: "Last week", start: addDays(thisWeekStart, -7), end: thisWeekStart };
  }

  if (preset === "last_7_days") {
    return { preset, label: "Last 7 days", start: addDays(now, -7), end: now };
  }

  if (preset === "last_30_days") {
    return { preset, label: "Last 30 days", start: addDays(now, -30), end: now };
  }

  return {
    preset,
    label: "Custom range",
    start: custom?.start ?? todayStart,
    end: custom?.end ?? tomorrowStart
  };
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

export function filterSourcesByDashboard(
  sources: SourceItem[],
  options: { window: DashboardTimeWindow; platform: DashboardPlatformFilter }
) {
  return sources.filter((source) => {
    if (options.platform === "all" && source.platform !== "instagram" && source.platform !== "tiktok") {
      return false;
    }

    if (options.platform !== "all" && source.platform !== options.platform) {
      return false;
    }

    const publishedAt = new Date(source.publishedAt).getTime();
    return publishedAt >= options.window.start.getTime() && publishedAt < options.window.end.getTime();
  });
}

export function sortDashboardSources(sources: SourceItem[], sortKey: DashboardSortKey) {
  return [...sources].sort((a, b) => {
    if (sortKey === "latest") {
      return sortableDate(b.publishedAt) - sortableDate(a.publishedAt);
    }

    if (sortKey === "collected") {
      return sortableDate(b.collectedAt) - sortableDate(a.collectedAt);
    }

    if (sortKey === "heat") {
      return sourceHeatScore(b) - sourceHeatScore(a);
    }

    return (b.metrics?.[sortKey] ?? 0) - (a.metrics?.[sortKey] ?? 0);
  });
}

export function dashboardStateToStorage(state: DashboardPersistedState) {
  return JSON.stringify(state);
}

export function dashboardStateFromStorage(
  value: string | null | undefined
): DashboardPersistedState | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as Partial<DashboardPersistedState>;
    const timePreset = isTimePreset(parsed.timePreset) ? parsed.timePreset : "this_week";
    const platform = isPlatformFilter(parsed.platform) ? parsed.platform : "all";
    const sortKey = isSortKey(parsed.sortKey) ? parsed.sortKey : "heat";

    return {
      timePreset,
      platform,
      sortKey,
      customStart: typeof parsed.customStart === "string" ? parsed.customStart : "",
      customEnd: typeof parsed.customEnd === "string" ? parsed.customEnd : ""
    };
  } catch {
    return undefined;
  }
}

export function buildTimeWindowTrendSummaries(
  trends: TrendTopic[],
  filteredSources: SourceItem[]
): TimeWindowTrendSummary[] {
  const sourceById = new Map(filteredSources.map((source) => [source.id, source]));

  return trends
    .map((trend) => {
      const trendSources = trend.sourceIds
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source): source is SourceItem => Boolean(source));
      const platformBreakdown = emptyPlatformBreakdown();

      for (const source of trendSources) {
        platformBreakdown[source.platform] += 1;
      }

      return {
        trend,
        filteredSources: trendSources,
        filteredSourceCount: trendSources.length,
        platformBreakdown,
        representative: sortDashboardSources(trendSources, "heat")[0]
      };
    })
    .filter((summary) => summary.filteredSourceCount > 0)
    .sort((a, b) => b.trend.heatScore - a.trend.heatScore || b.filteredSourceCount - a.filteredSourceCount);
}

export function buildFollowUpCandidates(
  filteredSources: SourceItem[],
  trends: TrendTopic[],
  limit = 8
): FollowUpCandidate[] {
  const trendBySourceId = new Map<string, TrendTopic>();

  for (const trend of trends) {
    for (const sourceId of trend.sourceIds) {
      const current = trendBySourceId.get(sourceId);
      if (!current || trend.heatScore > current.heatScore) {
        trendBySourceId.set(sourceId, trend);
      }
    }
  }

  return filteredSources
    .map((source) => {
      const trend = trendBySourceId.get(source.id);
      const score = sourceHeatScore(source);
      const reasons = followUpReasons(source, trend, score);

      return { source, trend, score, reasons };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatCompactNumber(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 10000 ? 1 : 0
  }).format(value);
}

function followUpReasons(source: SourceItem, trend: TrendTopic | undefined, score: number) {
  const reasons: string[] = [];
  const metrics = source.metrics ?? {};
  const platformLabel = source.platform === "tiktok" ? "TikTok" : source.platform === "instagram" ? "Instagram" : "X";

  if (score >= 100000) {
    reasons.push(`High ${platformLabel} heat`);
  }

  if ((metrics.shares ?? 0) >= 500 || ((metrics.shares ?? 0) > 0 && (metrics.shares ?? 0) / Math.max(metrics.likes ?? 1, 1) >= 0.12)) {
    reasons.push(`High ${platformLabel} shares`);
  }

  if ((metrics.comments ?? 0) >= 300) {
    reasons.push("Strong comments signal");
  }

  if ((trend?.platformBreakdown.instagram ?? 0) > 0 && (trend?.platformBreakdown.tiktok ?? 0) > 0) {
    reasons.push("Cross-platform trend evidence");
  }

  if (source.thumbnailUrl && source.authorHandle && source.url) {
    reasons.push("Ready creative reference");
  }

  return reasons;
}

function emptyPlatformBreakdown(): Record<Platform, number> {
  return { instagram: 0, tiktok: 0, x: 0 };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const dayStart = startOfDay(date);
  const day = dayStart.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(dayStart, -daysSinceMonday);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sortableDate(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isTimePreset(value: unknown): value is DashboardTimePreset {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "this_week" ||
    value === "last_week" ||
    value === "last_7_days" ||
    value === "last_30_days" ||
    value === "custom"
  );
}

function isPlatformFilter(value: unknown): value is DashboardPlatformFilter {
  return value === "all" || value === "instagram" || value === "tiktok";
}

function isSortKey(value: unknown): value is DashboardSortKey {
  return (
    value === "heat" ||
    value === "latest" ||
    value === "collected" ||
    value === "likes" ||
    value === "comments" ||
    value === "shares"
  );
}
