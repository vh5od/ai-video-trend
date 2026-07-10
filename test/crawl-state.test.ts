import { describe, expect, test } from "vitest";
import { restoreCrawlState, serializeCrawlState } from "@/lib/crawl-state";

describe("crawl state persistence", () => {
  test("round trips the last crawl result and running platform", () => {
    const serialized = serializeCrawlState(
      {
        runningPlatform: "tiktok",
        result: {
          status: "running",
          message: "TikTok crawl is running."
        }
      },
      new Date("2026-07-10T10:00:00.000Z")
    );

    expect(restoreCrawlState(serialized)).toEqual({
      runningPlatform: "tiktok",
      result: {
        status: "running",
        message: "TikTok crawl is running."
      },
      savedAt: "2026-07-10T10:00:00.000Z"
    });
  });

  test("ignores corrupt stored state", () => {
    expect(restoreCrawlState("{bad json")).toBeNull();
    expect(restoreCrawlState(null)).toBeNull();
  });
});
