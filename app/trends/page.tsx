"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RadioTower } from "lucide-react";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { useI18n } from "@/components/AppShell";
import { formatCompactNumber, sortDashboardSources } from "@/lib/dashboard";

export default function TrendCardsPage() {
  const { dictionary } = useI18n();
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);

  useEffect(() => {
    async function load() {
      const [trendResponse, sourceResponse] = await Promise.all([
        fetch("/api/trends"),
        fetch("/api/sources")
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
          const evidence = trend.sourceIds
            .map((sourceId) => sourceById.get(sourceId))
            .filter((source): source is SourceItem => Boolean(source));
          const representative = sortDashboardSources(evidence, "heat")[0];
          return { trend, evidence, representative };
        }),
    [sourceById, trends]
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-muted">
          {dictionary.trends.eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{dictionary.trends.title}</h2>
        <p className="mt-2 max-w-4xl text-sm text-muted">
          {dictionary.trends.description}
        </p>
      </header>

      {cards.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2">
          {cards.map(({ trend, evidence, representative }) => (
            <article
              key={trend.id}
              className="overflow-hidden border border-line bg-white"
            >
              <TrendMedia source={representative} />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-blue-200 bg-blue-50 text-blue-700"
                        title="Repeated signal"
                        aria-label="Repeated signal"
                      >
                        <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <h3 className="truncate text-base font-semibold text-ink">
                        {trend.title.replace(/\s+Signals$/i, "")}
                      </h3>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted">
                      {trend.summary}
                    </p>
                  </div>
                  <Badge tone={trend.status}>{trend.status}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label={dictionary.trends.heat} value={formatCompactNumber(trend.heatScore)} />
                  <Metric label="TikTok" value={trend.platformBreakdown.tiktok} />
                  <Metric label="Instagram" value={trend.platformBreakdown.instagram} />
                </div>

                <div className="flex flex-wrap gap-1">
                  {trend.keywords.slice(0, 8).map((keyword) => (
                    <Badge key={keyword}>{keyword}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-muted">
                    {evidence.length || trend.sourceCount} {dictionary.trends.sources}
                  </span>
                  <Link
                    className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
                    href={`/trends/${trend.id}`}
                  >
                    {dictionary.trends.openDetail}
                  </Link>
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

function TrendMedia({ source }: { source?: SourceItem }) {
  if (!source?.thumbnailUrl) {
    return (
      <div className="flex aspect-video items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-wide text-muted">
        {source?.platform ?? "trend"}
      </div>
    );
  }

  return (
    <a href={source.url} target="_blank" rel="noreferrer">
      <img
        src={source.thumbnailUrl}
        alt={source.title || source.platform}
        className="aspect-video w-full bg-slate-100 object-cover"
        referrerPolicy="no-referrer"
      />
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line bg-slate-50 p-2">
      <p className="text-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  );
}
