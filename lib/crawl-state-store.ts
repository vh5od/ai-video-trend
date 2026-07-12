import {
  CRAWL_STATE_STORAGE_KEY,
  restoreCrawlState,
  serializeCrawlState,
  type CrawlPlatform,
  type CrawlResult
} from "./crawl-state";

export interface CrawlStateSnapshot {
  result: CrawlResult | null;
  runningPlatform: CrawlPlatform | null;
  hydrated: boolean;
}

interface CrawlStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SERVER_SNAPSHOT: CrawlStateSnapshot = {
  result: null,
  runningPlatform: null,
  hydrated: false
};

export function createCrawlStateStore() {
  let snapshot: CrawlStateSnapshot = SERVER_SNAPSHOT;
  let storage: CrawlStateStorage | null = null;
  let activeController: AbortController | null = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());

  const persist = () => {
    if (!storage || !snapshot.hydrated) return;
    storage.setItem(
      CRAWL_STATE_STORAGE_KEY,
      serializeCrawlState({
        result: snapshot.result,
        runningPlatform: snapshot.runningPlatform
      })
    );
  };

  const replace = (
    next: Pick<CrawlStateSnapshot, "result" | "runningPlatform">,
    shouldPersist = true
  ) => {
    snapshot = { ...next, hydrated: true };
    if (shouldPersist) persist();
    emit();
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate: (nextStorage: CrawlStateStorage) => {
      storage = nextStorage;
      if (snapshot.hydrated) return;

      const persisted = restoreCrawlState<CrawlResult>(
        storage.getItem(CRAWL_STATE_STORAGE_KEY)
      );
      if (!persisted) {
        snapshot = { ...SERVER_SNAPSHOT, hydrated: true };
        emit();
        return;
      }

      const isDetachedRun =
        persisted.result?.status === "running" && activeController === null;
      const result = isDetachedRun
        ? {
            ...persisted.result!,
            status: "interrupted" as const,
            message:
              "Crawl connection was interrupted by a page reload. Last known progress is preserved; start a new crawl to continue."
          }
        : persisted.result;

      replace(
        {
          result,
          runningPlatform: isDetachedRun
            ? null
            : (persisted.runningPlatform as CrawlPlatform | null)
        },
        isDetachedRun || persisted.version === 1
      );
    },
    applyExternalValue: (value: string | null) => {
      const persisted = restoreCrawlState<CrawlResult>(value);
      if (!persisted) return;
      replace(
        {
          result: persisted.result,
          runningPlatform: persisted.runningPlatform as CrawlPlatform | null
        },
        false
      );
    },
    setResult: (
      value:
        | CrawlResult
        | null
        | ((current: CrawlResult | null) => CrawlResult | null)
    ) => {
      const result = typeof value === "function" ? value(snapshot.result) : value;
      replace({ result, runningPlatform: snapshot.runningPlatform });
    },
    setRunningPlatform: (runningPlatform: CrawlPlatform | null) => {
      replace({ result: snapshot.result, runningPlatform });
    },
    setActiveController: (controller: AbortController) => {
      activeController = controller;
    },
    clearActiveController: (controller: AbortController) => {
      if (activeController === controller) activeController = null;
    },
    abortActiveController: () => {
      activeController?.abort();
      activeController = null;
    },
    hasActiveController: () => activeController !== null
  };
}

type CrawlStore = ReturnType<typeof createCrawlStateStore>;
type CrawlStateWindow = Window & {
  __AI_VIDEO_TREND_CRAWL_STORE__?: CrawlStore;
  __AI_VIDEO_TREND_CRAWL_STORAGE_LISTENER__?: boolean;
};

const crawlWindow =
  typeof window === "undefined" ? null : (window as CrawlStateWindow);

export const crawlStateStore =
  crawlWindow?.__AI_VIDEO_TREND_CRAWL_STORE__ ?? createCrawlStateStore();

if (crawlWindow) {
  crawlWindow.__AI_VIDEO_TREND_CRAWL_STORE__ = crawlStateStore;
}

export function hydrateBrowserCrawlState() {
  if (typeof window === "undefined") return;
  crawlStateStore.hydrate(window.localStorage);
  const currentWindow = window as CrawlStateWindow;
  if (currentWindow.__AI_VIDEO_TREND_CRAWL_STORAGE_LISTENER__) return;
  currentWindow.__AI_VIDEO_TREND_CRAWL_STORAGE_LISTENER__ = true;
  window.addEventListener("storage", (event) => {
    if (event.key === CRAWL_STATE_STORAGE_KEY) {
      crawlStateStore.applyExternalValue(event.newValue);
    }
  });
}