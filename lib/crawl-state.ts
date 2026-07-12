import type { CollectionRun } from "./types";

export const CRAWL_STATE_STORAGE_KEY = "ai-video-trend-crawl-state";
export const CRAWL_STATE_VERSION = 2;

export type CrawlPlatform = "instagram" | "tiktok" | "all";
export type CrawlResultStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "paused"
  | "stopped"
  | "interrupted";

export interface PlannedCrawlTask {
  platform: "instagram" | "tiktok";
  mode: "hashtag" | "keyword" | "account";
  query: string;
}

export interface CrawlResult {
  status: CrawlResultStatus;
  platform: CrawlPlatform;
  tasks: number;
  itemsFound: number;
  itemsStored: number;
  runs: CollectionRun[];
  message: string;
  plannedTasks?: PlannedCrawlTask[];
}

export interface PersistedCrawlState<T> {
  version: 1 | typeof CRAWL_STATE_VERSION;
  result: T | null;
  runningPlatform: string | null;
  savedAt: string;
}

export function serializeCrawlState<T>(
  state: Pick<PersistedCrawlState<T>, "result" | "runningPlatform">,
  now = new Date()
): string {
  return JSON.stringify({
    version: CRAWL_STATE_VERSION,
    ...state,
    savedAt: now.toISOString()
  });
}

export function restoreCrawlState<T>(value: string | null): PersistedCrawlState<T> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersistedCrawlState<T>>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "string") {
      return null;
    }
    if (parsed.version !== undefined && parsed.version !== CRAWL_STATE_VERSION) {
      return null;
    }
    return {
      version: parsed.version === CRAWL_STATE_VERSION ? CRAWL_STATE_VERSION : 1,
      result: parsed.result ?? null,
      runningPlatform:
        typeof parsed.runningPlatform === "string" ? parsed.runningPlatform : null,
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
}