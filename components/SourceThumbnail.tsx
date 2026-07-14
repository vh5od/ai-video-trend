"use client";

import { useEffect, useState } from "react";
import type { SourceItem } from "@/lib/types";
import { apiFetch } from "@/lib/client-api";

const pendingReports = new Set<string>();
let reportTimer: ReturnType<typeof setTimeout> | undefined;

function reportBrokenThumbnail(sourceId: string) {
  pendingReports.add(sourceId);
  if (reportTimer) return;

  reportTimer = setTimeout(() => {
    const sourceIds = Array.from(pendingReports);
    pendingReports.clear();
    reportTimer = undefined;
    void apiFetch("/api/thumbnail-repairs/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds })
    }).catch(() => undefined);
  }, 500);
}

export function SourceThumbnail({
  source,
  className,
  fallbackClassName,
  alt
}: {
  source: SourceItem;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [source.thumbnailUrl]);

  if (!source.thumbnailUrl || failed) {
    return (
      <div
        className={
          fallbackClassName ??
          "flex h-full w-full items-center justify-center px-2 text-center text-xs font-medium uppercase text-muted"
        }
      >
        {source.platform}
      </div>
    );
  }

  return (
    <img
      src={source.thumbnailUrl}
      alt={alt ?? source.title ?? source.platform}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
        reportBrokenThumbnail(source.id);
      }}
    />
  );
}