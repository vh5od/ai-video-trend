"use client";

import type { SourceItem } from "@/lib/types";
import { Badge } from "./Badge";
import { SourceActionLink } from "./SourceActionLink";
import { SourceThumbnail } from "./SourceThumbnail";

export function SourceTable({ sources }: { sources: SourceItem[] }) {
  return (
    <div className="data-surface overflow-hidden border border-line bg-white">
      <table className="text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Preview</th>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">Author</th>
            <th className="px-3 py-2">Caption</th>
            <th className="px-3 py-2">Engagement</th>
            <th className="px-3 py-2">Published</th>
            <th className="px-3 py-2">URL</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="motion-row border-t border-line align-top">
              <td className="px-3 py-3">
                <SourcePreview source={source} />
              </td>
              <td className="px-3 py-3">
                <Badge tone={source.platform}>{source.platform}</Badge>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{source.authorName}</p>
                <p className="text-xs text-muted">@{source.authorHandle || "unknown"}</p>
              </td>
              <td className="px-3 py-3">
                <p className="max-w-2xl">{source.text}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {source.hashtags.slice(0, 5).map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-700">
                <p>Views: {source.metrics.views ?? "-"}</p>
                <p>Likes: {source.metrics.likes ?? "-"}</p>
                <p>Comments: {source.metrics.comments ?? "-"}</p>
                <p>Shares: {source.metrics.shares ?? "-"}</p>
              </td>
              <td className="px-3 py-3 text-xs text-muted">
                {new Date(source.publishedAt).toLocaleString()}
              </td>
              <td className="px-3 py-3">
                <SourceActionLink className="text-xs" href={source.url} />
              </td>
            </tr>
          ))}
          {sources.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-muted" colSpan={7}>
                No source items yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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