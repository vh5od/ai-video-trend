import type { CrawlerTask, Settings } from "./types";

export function buildDailyCrawlTasks(
  settings: Settings,
  options: { platform?: CrawlerTask["platform"] | "all" } = {}
): CrawlerTask[] {
  const legacyLimit = clampLimit(settings.dailyCrawlLimit);
  const hashtagLimit = clampLimit(settings.hashtagCrawlLimit ?? legacyLimit);
  const creatorLimit = clampLimit(settings.creatorCrawlLimit ?? legacyLimit);
  const platform = options.platform ?? "all";

  return [
    ...(platform === "all" || platform === "instagram"
      ? [
          ...settings.instagramHashtags.map((query) =>
            buildTask("instagram", "hashtag", query, hashtagLimit)
          ),
          ...settings.instagramCreators.map((query) =>
            buildTask("instagram", "account", query, creatorLimit)
          )
        ]
      : []),
    ...(platform === "all" || platform === "tiktok"
      ? [
          ...settings.tiktokHashtags.map((query) =>
            buildTask("tiktok", "hashtag", query, hashtagLimit)
          ),
          ...settings.tiktokCreators.map((query) =>
            buildTask("tiktok", "account", query, creatorLimit)
          )
        ]
      : [])
  ].filter((task) => task.query);
}

function buildTask(
  platform: CrawlerTask["platform"],
  mode: CrawlerTask["mode"],
  query: string,
  limit: number
): CrawlerTask {
  return {
    platform,
    mode,
    query: normalizeQuery(query, mode),
    provider: "browser_session",
    limit,
    sortBy: "latest",
    filterToKeywords: false
  };
}

function normalizeQuery(value: string, mode: CrawlerTask["mode"]): string {
  const trimmed = value.trim();
  if (mode === "hashtag") {
    return trimmed.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
  }
  if (mode === "account") {
    return trimmed.replace(/^@+/, "").toLowerCase();
  }
  return trimmed;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.floor(value), 500));
}

export function isFatalBrowserSessionError(message: string): boolean {
  return /browser session is not (?:connected|logged in)|browser session account is suspended|blocked by login or verification|No visible .* post\/video links found/i.test(
    message
  );
}
