"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { MonitorStatus } from "@/components/MonitorStatus";
import { useI18n } from "@/components/AppShell";
import { SourceActionLink } from "@/components/SourceActionLink";
import { formatCompactNumber, sortDashboardSources } from "@/lib/dashboard";
import { apiFetch } from "@/lib/client-api";

export default function TrendCardsPage() {
  const { dictionary } = useI18n();
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);

  useEffect(() => {
    async function load() {
      const [trendResponse, sourceResponse] = await Promise.all([
        apiFetch("/api/trends"),
        apiFetch("/api/sources")
      ]);
      const trendJson = await trendResponse.json();
      const sourceJson = await sourceResponse.json();
      setTrends(trendJson.trends ?? []);
      setSources(sourceJson.sources ?? []);
    }

    void load();
  }, []);

  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  );

  const cards = useMemo(
    () =>
      [...trends]
        .sort((a, b) => b.heatScore - a.heatScore || b.sourceCount - a.sourceCount)
        .map((trend) => {
          const evidence = sortDashboardSources(
            trend.sourceIds
              .map((sourceId) => sourceById.get(sourceId))
              .filter((source): source is SourceItem => Boolean(source)),
            "heat"
          );
          return { trend, evidence };
        }),
    [sourceById, trends]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">
            {dictionary.trends.eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{dictionary.trends.title}</h2>
          <p className="mt-2 max-w-4xl text-sm text-muted">
            {dictionary.trends.description}
          </p>
        </div>
        <MonitorStatus
          className="mt-1"
          prefix="CURRENTLY:"
          status={cards[0]?.trend.status ?? "stable"}
        />
      </header>

      {cards.length > 0 ? (
        <section className="trend-card-grid grid gap-4">
          {cards.map(({ trend, evidence }, index) => (
            <article
              key={trend.id}
              className="motion-card trend-editorial-card border border-line bg-white"
            >
              <div className="trend-editorial-top">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="trend-index">[{String(index + 1).padStart(2, "0")} TREND]</p>
                    <h3>{trend.title.replace(/\s+Signals$/i, "")}</h3>
                  </div>
                  <MonitorStatus status={trend.status} />
                </div>
                <p className="trend-meta">
                  HEAT {formatCompactNumber(trend.heatScore)} / {evidence.length || trend.sourceCount} SOURCES<br />
                  TIKTOK {trend.platformBreakdown.tiktok} / INSTAGRAM {trend.platformBreakdown.instagram}
                </p>
              </div>

              <div className="trend-editorial-visual">
                <TrendMedia sources={evidence} />
              </div>

              <div className="trend-editorial-bottom">
                <p className="line-clamp-3 text-sm font-medium leading-5 text-ink">
                  {trend.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-1">
                  {trend.keywords.slice(0, 5).map((keyword) => (
                    <Badge key={keyword}>{keyword}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="trend-meta">{evidence.length || trend.sourceCount} DATA SOURCES</span>
                  <SourceActionLink
                    className="text-[11px]"
                    external={false}
                    href={`/trends/${trend.id}`}
                    label="OPEN TREND"
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="border border-line bg-white p-8 text-center text-sm text-muted">
          {dictionary.trends.empty}
        </section>
      )}
    </div>
  );
}

function TrendMedia({ sources }: { sources: SourceItem[] }) {
  const previews = sources.filter((source) => Boolean(source.thumbnailUrl)).slice(0, 3);

  if (previews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 font-mono text-xs font-medium uppercase tracking-wide text-muted">
        {sources[0]?.platform ?? "trend evidence"}
      </div>
    );
  }

  return (
    <div className="trend-video-mosaic" aria-label={`${previews.length} representative videos`}>
      {previews.map((source) => (
        <a
          key={source.id}
          className="trend-video-tile"
          href={source.url}
          target="_blank"
          rel="noreferrer"
          title={source.title || source.authorName}
        >
          <img
            src={source.thumbnailUrl}
            alt={source.title || source.platform}
            referrerPolicy="no-referrer"
          />
          <span className="trend-video-tile-label">{source.platform}</span>
        </a>
      ))}
    </div>
  );
}
