import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Settings } from "@/lib/types";

const originalDataDir = process.env.AI_VIDEO_TREND_DATA_DIR;
const fallbackSettings: Settings = {
  instagramHashtags: [],
  instagramCreators: [],
  tiktokHashtags: [],
  tiktokCreators: [],
  keywords: [],
  dailyCrawlLimit: 50,
  commentsPerVideo: 30,
  minLikes: 0,
  refreshSchedule: "manual"
};

async function loadDataStore(dataDir: string) {
  vi.resetModules();
  process.env.AI_VIDEO_TREND_DATA_DIR = dataDir;
  return import("@/lib/data-store");
}

afterEach(async () => {
  vi.resetModules();
  if (originalDataDir === undefined) {
    delete process.env.AI_VIDEO_TREND_DATA_DIR;
  } else {
    process.env.AI_VIDEO_TREND_DATA_DIR = originalDataDir;
  }
});

describe("data store durability", () => {
  test("uses an isolated data directory override", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "trend-data-"));
    const store = await loadDataStore(dataDir);

    try {
      await store.writeSettings({ ...fallbackSettings, keywords: ["AI avatar"] });
      const raw = await readFile(path.join(dataDir, "settings.json"), "utf8");

      expect(JSON.parse(raw).keywords).toEqual(["AI avatar"]);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test("does not silently replace corrupt JSON with fallback data", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "trend-data-"));
    const store = await loadDataStore(dataDir);

    try {
      await writeFile(path.join(dataDir, "settings.json"), "{not json", "utf8");

      await expect(store.readSettings()).rejects.toThrow("settings.json");
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test("serializes write transactions so later reads include earlier writes", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "trend-data-"));
    const store = await loadDataStore(dataDir);

    try {
      await Promise.all([
        store.withDataStoreLock(async () => {
          const current = await store.readCollectionRuns();
          await store.writeCollectionRuns([{ id: "run_a" } as never, ...current]);
        }),
        store.withDataStoreLock(async () => {
          const current = await store.readCollectionRuns();
          await store.writeCollectionRuns([{ id: "run_b" } as never, ...current]);
        })
      ]);

      expect((await store.readCollectionRuns()).map((run) => run.id).sort()).toEqual([
        "run_a",
        "run_b"
      ]);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
