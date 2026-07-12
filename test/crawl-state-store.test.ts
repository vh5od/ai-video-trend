import { describe, expect, test } from "vitest";
import { CRAWL_STATE_STORAGE_KEY, serializeCrawlState, type CrawlResult } from "@/lib/crawl-state";
import { createCrawlStateStore } from "@/lib/crawl-state-store";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value
  };
}

function result(status: CrawlResult["status"]): CrawlResult {
  return {
    status,
    platform: "tiktok",
    tasks: 3,
    itemsFound: 8,
    itemsStored: 5,
    runs: [],
    message: `${status} crawl`
  };
}

describe("crawl state store", () => {
  test("hydrates only once and does not overwrite restored state with null", () => {
    const storage = memoryStorage(serializeCrawlState({ result: result("success"), runningPlatform: null }));
    const store = createCrawlStateStore();
    store.hydrate(storage);
    store.hydrate(storage);
    expect(store.getSnapshot().result?.status).toBe("success");
    expect(JSON.parse(storage.value()!).result.status).toBe("success");
  });

  test("keeps updates made while the settings page is unmounted", () => {
    const storage = memoryStorage();
    const store = createCrawlStateStore();
    store.hydrate(storage);
    store.setRunningPlatform("tiktok");
    store.setResult(result("running"));
    store.setResult(result("success"));
    store.setRunningPlatform(null);
    expect(store.getSnapshot()).toMatchObject({
      result: { status: "success", itemsStored: 5 },
      runningPlatform: null
    });
  });

  test("marks a cold-restored running request as interrupted", () => {
    const storage = memoryStorage(serializeCrawlState({ result: result("running"), runningPlatform: "tiktok" }));
    const store = createCrawlStateStore();
    store.hydrate(storage);
    expect(store.getSnapshot()).toMatchObject({
      result: { status: "interrupted", tasks: 3, itemsFound: 8, itemsStored: 5 },
      runningPlatform: null
    });
  });

  test.each(["success", "partial", "failed", "paused", "stopped"] as const)(
    "restores terminal status %s",
    (status) => {
      const storage = memoryStorage(serializeCrawlState({ result: result(status), runningPlatform: null }));
      const store = createCrawlStateStore();
      store.hydrate(storage);
      expect(store.getSnapshot().result?.status).toBe(status);
    }
  );

  test("applies state received from another browser tab", () => {
    const store = createCrawlStateStore();
    store.hydrate(memoryStorage());
    store.applyExternalValue(
      serializeCrawlState({ result: result("running"), runningPlatform: "tiktok" })
    );
    expect(store.getSnapshot()).toMatchObject({
      result: { status: "running" },
      runningPlatform: "tiktok"
    });
  });
});