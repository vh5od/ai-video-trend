"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { useI18n } from "@/components/AppShell";
import { MetricStrip } from "@/components/MetricStrip";
import { MonitorStatus } from "@/components/MonitorStatus";
import { DashboardControls } from "@/components/DashboardControls";
import { FollowUpCandidates } from "@/components/FollowUpCandidates";
import { SourceLeaderboard } from "@/components/SourceLeaderboard";
import { TimeWindowTrendMap } from "@/components/TimeWindowTrendMap";
import {
  buildFollowUpCandidates,
  buildTimeWindowTrendSummaries,
  DASHBOARD_STATE_STORAGE_KEY,
  dashboardStateFromStorage,
  dashboardStateToStorage,
  filterSourcesByDashboard,
  formatCompactNumber,
  getDashboardTimeWindow,
  sortDashboardSources,
  type DashboardPlatformFilter,
  type DashboardSortKey,
  type DashboardTimePreset
} from "@/lib/dashboard";

export default function DashboardPage() {
  const { dictionary } = useI18n();
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [timePreset, setTimePreset] = useState<DashboardTimePreset>("this_week");
  const [platform, setPlatform] = useState<DashboardPlatformFilter>("all");
  const [sortKey, setSortKey] = useState<DashboardSortKey>("heat");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stateLoaded, setStateLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [trendResponse, sourceResponse] = await Promise.all([
        fetch("/api/trends"),
        fetch("/api/sources")
      ]);
      const trendJson = await trendResponse.json();
      const sourceJson = await sourceResponse.json();
      setTrends(trendJson.trends);
      setSources(sourceJson.sources);
    }
    void load();
  }, []);

  useEffect(() => {
    const saved = dashboardStateFromStorage(
      window.localStorage.getItem(DASHBOARD_STATE_STORAGE_KEY)
    );

    if (saved) {
      setTimePreset(saved.timePreset);
      setPlatform(saved.platform);
      setSortKey(saved.sortKey);
      setCustomStart(saved.customStart);
      setCustomEnd(saved.customEnd);
    }

    setStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!stateLoaded) {
      return;
    }

    window.localStorage.setItem(
      DASHBOARD_STATE_STORAGE_KEY,
      dashboardStateToStorage({ timePreset, platform, sortKey, customStart, customEnd })
    );
  }, [customEnd, customStart, platform, sortKey, stateLoaded, timePreset]);

  const timeWindow = useMemo(
    () =>
      getDashboardTimeWindow(timePreset, new Date(), {
        start: customStart ? new Date(`${customStart}T00:00:00`) : undefined,
        end: customEnd ? addOneDay(new Date(`${customEnd}T00:00:00`)) : undefined
      }),
    [customEnd, customStart, timePreset]
  );

  const filteredSources = useMemo(
    () => filterSourcesByDashboard(sources, { window: timeWindow, platform }),
    [platform, sources, timeWindow]
  );

  const rankedSources = useMemo(
    () => sortDashboardSources(filteredSources, sortKey),
    [filteredSources, sortKey]
  );

  const trendSummaries = useMemo(
    () => buildTimeWindowTrendSummaries(trends, filteredSources),
    [filteredSources, trends]
  );

  const followUpCandidates = useMemo(
    () => buildFollowUpCandidates(filteredSources, trends),
    [filteredSources, trends]
  );

  const trendsBySourceId = useMemo(() => {
    const map = new Map<string, TrendTopic[]>();

    for (const trend of trends) {
      for (const sourceId of trend.sourceIds) {
        const list = map.get(sourceId) ?? [];
        list.push(trend);
        map.set(sourceId, list);
      }
    }

    return map;
  }, [trends]);

  const selectedStats = useMemo(() => {
    const totals = filteredSources.reduce(
      (summary, source) => ({
        tiktok: summary.tiktok + (source.platform === "tiktok" ? 1 : 0),
        instagram: summary.instagram + (source.platform === "instagram" ? 1 : 0),
        engagement:
          summary.engagement +
          (source.metrics.views ?? 0) +
          (source.metrics.likes ?? 0) +
          (source.metrics.comments ?? 0) +
          (source.metrics.shares ?? 0)
      }),
      { tiktok: 0, instagram: 0, engagement: 0 }
    );

    return {
      ...totals,
      trends: trendSummaries.length,
      followUps: followUpCandidates.length
    };
  }, [filteredSources, followUpCandidates.length, trendSummaries.length]);

  return (
    <div className="space-y-5">
      <section className="dashboard-overview">
        <header className="dashboard-overview-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">
              {dictionary.dashboard.eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{dictionary.dashboard.title}</h2>
            <p className="mt-2 max-w-4xl text-sm text-muted">
              {dictionary.dashboard.description}
            </p>
          </div>
          <div className="dashboard-overview-actions">
            <MonitorStatus
              className="justify-end"
              prefix="CURRENTLY:"
              status={trendSummaries[0]?.trend.status ?? "stable"}
            />
            <Link href="/trends" className="dashboard-trend-link text-sm font-semibold text-ink">
              {dictionary.dashboard.trendCardsLink}
            </Link>
          </div>
        </header>
        <MetricStrip
          items={[
            { label: dictionary.dashboard.tiktokSources, value: selectedStats.tiktok },
            { label: dictionary.dashboard.instagramSources, value: selectedStats.instagram },
            {
              label: dictionary.dashboard.totalEngagement,
              value: formatCompactNumber(selectedStats.engagement)
            },
            { label: dictionary.dashboard.mappedTrends, value: selectedStats.trends },
            { label: dictionary.dashboard.followUps, value: selectedStats.followUps }
          ]}
        />
        <DashboardControls
          timePreset={timePreset}
          platform={platform}
          sortKey={sortKey}
          customStart={customStart}
          customEnd={customEnd}
          onTimePresetChange={setTimePreset}
          onPlatformChange={setPlatform}
          onSortKeyChange={setSortKey}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
        <div className="dashboard-window-note text-xs text-muted">
          {dictionary.dashboard.showingWindow} {timeWindow.start.toLocaleString()} -{" "}
          {timeWindow.end.toLocaleString()}.
        </div>
      </section>
      <SourceLeaderboard sources={rankedSources} trendsBySourceId={trendsBySourceId} />
      <TimeWindowTrendMap summaries={trendSummaries} />
      <FollowUpCandidates candidates={followUpCandidates} />
    </div>
  );
}

function addOneDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}
