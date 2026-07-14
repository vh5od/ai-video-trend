"use client";


import Link from "next/link";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { formatCompactNumber, sourceHeatScore } from "@/lib/dashboard";
import { Badge } from "./Badge";
import { SourceActionLink } from "./SourceActionLink";
import { SourceThumbnail } from "./SourceThumbnail";

export function SourceLeaderboard({
  sources,
  trendsBySourceId
}: {
  sources: SourceItem[];
  trendsBySourceId: Map<string, TrendTopic[]>;
}) {
  return (
    <section className="source-leaderboard overflow-hidden border border-line bg-white">
      <div className="border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">Source leaderboard</h3>
        <p className="text-xs text-muted">
          Ranked recent TikTok and Instagram evidence for trend review.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="source-leaderboard-table min-w-[1180px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Preview</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Caption</th>
              <th className="px-3 py-2">Metrics</th>
              <th className="px-3 py-2">Heat</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Collected</th>
              <th className="px-3 py-2">Links</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, index) => {
              const trends = trendsBySourceId.get(source.id) ?? [];

              return (
                <tr
                  key={source.id}
                  className="motion-row border-t border-line align-top"
                >
                  <td className="px-3 py-3 font-semibold text-slate-700">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3">
                    <SourcePreview source={source} />
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={source.platform}>{source.platform}</Badge>
                    <p className="mt-2 font-medium text-ink">
                      {source.authorName || "Unknown author"}
                    </p>
                    <p className="text-xs text-muted">
                      @{source.authorHandle || "unknown"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="max-w-xl font-medium text-ink">
                      {source.title || "Untitled source"}
                    </p>
                    <p className="mt-1 line-clamp-3 max-w-xl text-xs leading-5 text-slate-700">
                      {source.text || "-"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-700">
                    <MetricLine label="Views" value={source.metrics?.views} />
                    <MetricLine label="Likes" value={source.metrics?.likes} />
                    <MetricLine label="Comments" value={source.metrics?.comments} />
                    <MetricLine label="Shares" value={source.metrics?.shares} />
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink">
                    {formatCompactNumber(sourceHeatScore(source))}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {formatDate(source.publishedAt)}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {formatDate(source.collectedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <SourceActionLink href={source.url} />
                    <div className="mt-2 flex max-w-xs flex-wrap gap-1">
                      {trends.length > 0 ? (
                        trends.map((trend) => (
                          <Link
                            key={trend.id}
                            href={`/trends/${trend.id}`}
                            className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                          >
                            {trend.title}
                          </Link>
                        ))
                      ) : (
                        <span className="text-xs text-muted">No trend link</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted" colSpan={9}>
                  No ranked sources in this window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value?: number }) {
  return (
    <p className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-slate-800">
        {value == null ? "-" : formatCompactNumber(value)}
      </span>
    </p>
  );
}

function SourcePreview({ source }: { source: SourceItem }) {
  return (
    <a href={source.url} target="_blank" rel="noreferrer">
      <div className="media-preview relative flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-100">
        <SourceThumbnail source={source} className="h-full w-full object-cover" />
        {source.videoUrl ? (
          <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            video
          </span>
        ) : null}
      </div>
    </a>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}
