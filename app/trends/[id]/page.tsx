"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { MonitorStatus } from "@/components/MonitorStatus";
import { SourceTable } from "@/components/SourceTable";
import { SourceActionLink } from "@/components/SourceActionLink";
import { buildFollowUpCandidates } from "@/lib/dashboard";

type PlatformFilter = "all" | SourceItem["platform"];
type PlatformOption = { label: string; value: SourceItem["platform"] };

const platformOptions: PlatformOption[] = [
  { label: "Instagram", value: "instagram" },
  { label: "TikTok", value: "tiktok" },
  { label: "X", value: "x" }
];

const platformFilters: Array<{ label: string; value: PlatformFilter }> = [
  { label: "All", value: "all" },
  ...platformOptions
];

export default function TrendDetailPage() {
  const params = useParams<{ id: string }>();
  const [trend, setTrend] = useState<TrendTopic | null>(null);
  const [evidence, setEvidence] = useState<SourceItem[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/trends/${params.id}`);
      if (!response.ok) return;
      const json = await response.json();
      setTrend(json.trend);
      setEvidence(json.evidence);
    }
    void load();
  }, [params.id]);

  if (!trend) {
    return <p className="text-sm text-muted">Loading trend detail...</p>;
  }

  const representative = evidence[0];
  const filteredEvidence =
    platformFilter === "all"
      ? evidence
      : evidence.filter((source) => source.platform === platformFilter);
  const platformSummaries = platformOptions
    .map((filter) => ({
      ...filter,
      ...summarizePlatform(evidence, filter.value)
    }));
  const followUpCandidates = buildFollowUpCandidates(evidence, [trend], 5);

  return (
    <div className="editorial-subpage trend-detail-page space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-muted">Trend detail</p>
        <div className="mt-1 flex items-center gap-3">
          <h2 className="text-2xl font-semibold">{trend.title}</h2>
          <MonitorStatus status={trend.status} />
        </div>
        <p className="mt-2 max-w-4xl text-sm text-muted">{trend.summary}</p>
      </header>

      {representative ? (
        <section className="trend-representative grid gap-6 border border-line bg-white p-4 lg:grid-cols-[320px_1fr]">
          <div className="overflow-hidden border border-line bg-slate-100">
            {representative.videoUrl ? (
              <video
                className="aspect-video w-full bg-black object-cover"
                controls
                poster={representative.thumbnailUrl}
                src={representative.videoUrl}
              />
            ) : representative.thumbnailUrl ? (
              <img
                src={representative.thumbnailUrl}
                alt={representative.title}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-muted">
                No media preview
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted">
              Representative source
            </p>
            <h3 className="mt-1 text-lg font-semibold">{representative.title}</h3>
            <div className="mt-2">
              <Badge tone={representative.platform}>{representative.platform}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{representative.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SourceActionLink className="text-sm" href={representative.url} />
              {representative.embedUrl ? (
                <a
                  className="border border-line bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  href={representative.embedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open embed
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="trend-detail-metrics grid gap-0 md:grid-cols-4">
        {[
          ["Heat", trend.heatScore],
          ["Engagement", trend.scoreBreakdown.engagement],
          ["Freshness", trend.scoreBreakdown.freshness],
          ["Sources", trend.sourceCount]
        ].map(([label, value]) => (
          <div key={label} className="trend-detail-metric border border-line bg-white p-4">
            <p className="text-xs font-medium uppercase text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Platform summary</h3>
          <p className="text-xs text-muted">Evidence totals by source platform</p>
        </div>
        <div className="trend-detail-platform-grid grid gap-0 lg:grid-cols-3">
          {platformSummaries.map((summary) => (
            <div key={summary.value} className="trend-detail-platform border border-line bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <Badge tone={summary.value}>{summary.label}</Badge>
                <span className="text-xs text-muted">{summary.sources} sources</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Metric label="Views" value={summary.views} />
                <Metric label="Likes" value={summary.likes} />
                <Metric label="Comments" value={summary.comments} />
                <Metric label="Shares" value={summary.shares} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-line bg-white p-4">
        <h3 className="text-base font-semibold">Why it ranks</h3>
        <p className="mt-2 text-sm text-muted">
          Score combines cross-platform engagement, recency, configured keyword relevance,
          and number of matching source items. This MVP uses deterministic grouping
          so every ranking can be traced back to source evidence.
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {trend.keywords.map((keyword) => (
            <Badge key={keyword}>{keyword}</Badge>
          ))}
        </div>
      </section>

      <section className="border border-line bg-white p-4">
        <h3 className="text-base font-semibold">Follow-up notes</h3>
        <div className="mt-3 space-y-3">
          {followUpCandidates.map((candidate) => (
            <div
              key={candidate.source.id}
              className="trend-followup-row border border-line bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={candidate.source.platform}>
                  {candidate.source.platform}
                </Badge>
                <span className="text-sm font-medium text-ink">
                  {candidate.source.authorName || "Unknown author"}
                </span>
                <SourceActionLink className="text-xs" href={candidate.source.url} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {candidate.reasons.map((reason) => (
                  <Badge key={reason}>{reason}</Badge>
                ))}
              </div>
            </div>
          ))}
          {followUpCandidates.length === 0 ? (
            <p className="text-sm text-muted">
              No rule-based follow-up notes for this trend yet.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-base font-semibold">Source evidence</h3>
          <div className="flex flex-wrap gap-2">
            {platformFilters.map((filter) => {
              const selected = platformFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  className={`border px-3 py-1.5 text-xs font-medium ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-line bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  type="button"
                  onClick={() => setPlatformFilter(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <SourceTable sources={filteredEvidence} />
      </section>
    </div>
  );
}

function summarizePlatform(sources: SourceItem[], platform: SourceItem["platform"]) {
  return sources
    .filter((source) => source.platform === platform)
    .reduce(
      (summary, source) => ({
        sources: summary.sources + 1,
        views: summary.views + (source.metrics.views ?? 0),
        likes: summary.likes + (source.metrics.likes ?? 0),
        comments: summary.comments + (source.metrics.comments ?? 0),
        shares: summary.shares + (source.metrics.shares ?? 0)
      }),
      { sources: 0, views: 0, likes: 0, comments: 0, shares: 0 }
    );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{formatCount(value)}</p>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
