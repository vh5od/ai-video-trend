import { describe, expect, test } from "vitest";
import {
  CRAWL_STATE_VERSION,
  restoreCrawlState,
  serializeCrawlState
} from "@/lib/crawl-state";

describe("crawl state persistence", () => {
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