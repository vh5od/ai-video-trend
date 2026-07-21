import { describe, expect, test } from "vitest";
import {
  categorizeCrawlTasks,
  CRAWL_STATE_VERSION,
  restoreCrawlState,
  serializeCrawlState
} from "@/lib/crawl-state";

describe("crawl state persistence", () => {
  test("separates completed, failed, and unexecuted planned tasks", () => {
    const plannedTasks = ["first", "second", "third"].map((query) => ({
      platform: "instagram" as const,
      mode: "hashtag" as const,
      query
    }));
    const baseRun = {
      platform: "instagram" as const,
      provider: "daily_browser_session_hashtag",
      startedAt: "2026-07-15T00:00:00.000Z",
      finishedAt: "2026-07-15T00:00:01.000Z",
      itemsFound: 0,
      itemsStored: 0,
      message: "done"
    };

    const categorized = categorizeCrawlTasks({
      status: "partial",
      platform: "instagram",
      tasks: 3,
      itemsFound: 1,
      itemsStored: 1,
      message: "partial",
      plannedTasks,
      runs: [
        { ...baseRun, id: "ready", status: "ready" },
        { ...baseRun, id: "failed", status: "failed" }
      ]
    });

    expect(categorized.completed.map(({ task }) => task?.query)).toEqual(["first"]);
    expect(categorized.failed.map(({ task }) => task?.query)).toEqual(["second"]);
    expect(categorized.notRun.map((task) => task.query)).toEqual(["third"]);
  });

  test("round trips the versioned crawl state", () => {
    const serialized = serializeCrawlState(
      {
        runningPlatform: "tiktok",
        result: { status: "running", message: "TikTok crawl is running." }
      },
      new Date("2026-07-10T10:00:00.000Z")
    );

    expect(restoreCrawlState(serialized)).toEqual({
      version: CRAWL_STATE_VERSION,
      runningPlatform: "tiktok",
      result: { status: "running", message: "TikTok crawl is running." },
      savedAt: "2026-07-10T10:00:00.000Z"
    });
  });

  test("accepts legacy unversioned state", () => {
    expect(
      restoreCrawlState(
        JSON.stringify({ result: null, runningPlatform: null, savedAt: "2026-07-10T10:00:00.000Z" })
      )
    ).toMatchObject({ version: 1, result: null, runningPlatform: null });
  });

  test("ignores corrupt and unknown-version state", () => {
    expect(restoreCrawlState("{bad json")).toBeNull();
    expect(restoreCrawlState(null)).toBeNull();
    expect(
      restoreCrawlState(JSON.stringify({ version: 99, savedAt: new Date().toISOString() }))
    ).toBeNull();
  });
});