import Link from "next/link";
import type { SourceItem, TrendTopic } from "@/lib/types";
import { Badge } from "./Badge";
import { MonitorStatus } from "./MonitorStatus";

export function TrendTable({
  trends,
  sources = []
}: {
  trends: TrendTopic[];
  sources?: SourceItem[];
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <div className="data-surface overflow-hidden border border-line bg-white">
      <table className="text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Rank</th>
            <th className="px-3 py-2">Preview</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2">Heat</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">TikTok Sources</th>
            <th className="px-3 py-2">Instagram Sources</th>
            <th className="px-3 py-2">X Sources</th>
            <th className="px-3 py-2">Keywords</th>
            <th className="px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend, index) => {
            const representative = sourceById.get(trend.sourceIds[0]);

            return (
              <tr key={trend.id} className="motion-row border-t border-line">
                <td className="px-3 py-3 font-medium">{index + 1}</td>
                <td className="px-3 py-3">
                  <Link href={`/trends/${trend.id}`}>
                    <PreviewThumb source={representative} />
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/trends/${trend.id}`} className="font-medium underline-offset-2 hover:underline">
                    {trend.title}
                  </Link>
                  <p className="mt-1 max-w-2xl text-xs text-muted">{trend.summary}</p>
                </td>
                <td className="px-3 py-3 font-semibold">{trend.heatScore}</td>
                <td className="px-3 py-3">
                  <MonitorStatus status={trend.status} />
                </td>
                <td className="px-3 py-3">{trend.platformBreakdown.tiktok ?? 0}</td>
                <td className="px-3 py-3">{trend.platformBreakdown.instagram ?? 0}</td>
                <td className="px-3 py-3">{trend.platformBreakdown.x ?? 0}</td>
                <td className="px-3 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {trend.keywords.slice(0, 4).map((keyword) => (
                      <Badge key={keyword}>{keyword}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted">
                  {new Date(trend.lastSeenAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
          {trends.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-muted" colSpan={10}>
                No trend topics yet. Add seed sources from Collection.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function PreviewThumb({ source }: { source?: SourceItem }) {
  if (!source?.thumbnailUrl) {
    return (
      <div className="flex h-16 w-24 items-center justify-center border border-line bg-slate-100 text-xs text-muted">
        No media
      </div>
    );
  }

  return (
    <div className="media-preview relative h-16 w-24 overflow-hidden rounded-lg border border-line bg-slate-100">
      <img
        src={source.thumbnailUrl}
        alt={source.title}
        className="h-full w-full object-cover"
      />
      {source.videoUrl ? (
        <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          video
        </span>
      ) : null}
    </div>
  );
}
