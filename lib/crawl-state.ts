export const CRAWL_STATE_STORAGE_KEY = "ai-video-trend-crawl-state";

export interface PersistedCrawlState<T> {
  result: T | null;
  runningPlatform: string | null;
  savedAt: string;
}

export function serializeCrawlState<T>(
  state: Omit<PersistedCrawlState<T>, "savedAt">,
  now = new Date()
): string {
  return JSON.stringify({
    ...state,
    savedAt: now.toISOString()
  });
}

export function restoreCrawlState<T>(value: string | null): PersistedCrawlState<T> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PersistedCrawlState<T>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "string") {
      return null;
    }
    return {
      result: parsed.result ?? null,
      runningPlatform:
        typeof parsed.runningPlatform === "string" ? parsed.runningPlatform : null,
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
}
