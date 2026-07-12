"use client";

import { useState } from "react";
import Link from "next/link";
import type { SourceItem } from "@/lib/types";
import type { TimeWindowTrendSummary } from "@/lib/dashboard";
import { formatCompactNumber } from "@/lib/dashboard";
import { Badge } from "./Badge";
import { MonitorStatus } from "./MonitorStatus";

export function TimeWindowTrendMap({
  summaries
}: {
  summaries: TimeWindowTrendSummary[];
}) {
  const visibleSummaries = summaries.filter(
    (summary) => summary.filteredSourceCount > 0
  );

  return (
    <section className="data-surface overflow-hidden border border-line bg-white">
      <div className="border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">Time-window trend map</h3>
        <p className="text-xs text-muted">
          Hotspots backed by filtered source evidence.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Trend</th>
              <th className="px-3 py-2">Heat</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">TikTok</th>
              <th className="px-3 py-2">Instagram</th>
              <th className="px-3 py-2">X</th>
              <th className="px-3 py-2">Representative</th>
              <th className="px-3 py-2">Keywords</th>
            </tr>
          </thead>
          <tbody>
            {visibleSummaries.map((summary) => (
              <tr
                key={summary.trend.id}
                className="motion-row border-t border-line align-top"
              >
                <td className="px-3 py-3">
                  <Link
                    href={`/trends/${summary.trend.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {summary.trend.title}
                  </Link>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    {summary.trend.summary}
                  </p>
                </td>
                <td className="px-3 py-3 font-semibold text-ink">
                  {formatCompactNumber(summary.trend.heatScore)}
                </td>
                <td className="px-3 py-3">
                  <MonitorStatus status={summary.trend.status} />
                </td>
                <td className="px-3 py-3 font-medium">
                  {summary.platformBreakdown.tiktok}
                </td>
                <td className="px-3 py-3 font-medium">
                  {summary.platformBreakdown.instagram}
                </td>
                <td className="px-3 py-3 font-medium">
                  {summary.platformBreakdown.x}
                </td>
                <td className="px-3 py-3">
                  <TrendPreview source={summary.representative} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {summary.trend.keywords.slice(0, 6).map((keyword) => (
                      <Badge key={keyword}>{keyword}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {visibleSummaries.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted" colSpan={8}>
                  No trends have source evidence in this window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrendPreview({ source }: { source?: SourceItem }) {
  const [failed, setFailed] = useState(false);
  const canShowImage = Boolean(source?.thumbnailUrl) && !failed;

  if (!source) {
    return (
      <div className="flex h-16 w-24 items-center justify-center border border-line bg-slate-100 text-xs text-muted">
        No media
      </div>
    );
  }

  return (
    <a href={source.url} target="_blank" rel="noreferrer">
      <div className="media-preview relative flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-100">
        {canShowImage ? (
          <img
            src={source.thumbnailUrl}
            alt={source.title || source.platform}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="px-2 text-center text-xs font-medium uppercase text-muted">
            {source.platform}
          </div>
        )}
        {source.videoUrl ? (
          <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            video
          </span>
        ) : null}
      </div>
    </a>
  );
}
