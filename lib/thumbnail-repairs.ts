import type { SourceItem, ThumbnailRepair } from "./types";

export function queueThumbnailRepair(
  repairs: ThumbnailRepair[],
  source: SourceItem,
  now: string
): ThumbnailRepair[] {
  if (source.platform !== "instagram" && source.platform !== "tiktok") {
    return repairs;
  }

  const existing = repairs.find((repair) => repair.sourceId === source.id);
  const next: ThumbnailRepair = {
    sourceId: source.id,
    platform: source.platform,
    sourceUrl: source.url,
    status: "pending",
    attempts: existing?.attempts ?? 0,
    reportedAt: existing?.reportedAt ?? now,
    updatedAt: now
  };

  return existing
    ? repairs.map((repair) => (repair.sourceId === source.id ? next : repair))
    : [next, ...repairs];
}

export function repairableThumbnailJobs(
  repairs: ThumbnailRepair[],
  limit = 10
): ThumbnailRepair[] {
  const eligible = repairs
    .filter((repair) => repair.status === "pending" || repair.status === "failed")
    .sort(
      (a, b) =>
        a.attempts - b.attempts || a.reportedAt.localeCompare(b.reportedAt)
    );
  const byPlatform = {
    instagram: eligible.filter((repair) => repair.platform === "instagram"),
    tiktok: eligible.filter((repair) => repair.platform === "tiktok")
  };
  const selected: ThumbnailRepair[] = [];
  const target = Math.max(1, limit);

  while (
    selected.length < target &&
    (byPlatform.instagram.length > 0 || byPlatform.tiktok.length > 0)
  ) {
    for (const platform of ["instagram", "tiktok"] as const) {
      const job = byPlatform[platform].shift();
      if (job) selected.push(job);
      if (selected.length >= target) break;
    }
  }

  return selected;
}

export function withRefreshedThumbnail(
  source: SourceItem,
  thumbnailUrl: string
): SourceItem {
  return {
    ...source,
    thumbnailUrl,
    collectedAt: source.collectedAt
  };
}

export function isUsableThumbnailUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  return /^https?:\/\//i.test(url) && !/transparent|spacer|1x1/i.test(url);
}