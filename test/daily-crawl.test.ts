import { describe, expect, test } from "vitest";
import { buildDailyCrawlTasks, isFatalBrowserSessionError } from "@/lib/daily-crawl";
import type { Settings } from "@/lib/types";

const settings: Settings = {
  instagramHashtags: ["aivideo", "#runway"],
  instagramCreators: ["runwayml", "@heygen_official"],
  tiktokHashtags: ["aitools"],
  tiktokCreators: ["@demo"],
  keywords: ["AI video"],
  dailyCrawlLimit: 25,
  hashtagCrawlLimit: 80,
  creatorCrawlLimit: 12,
  commentsPerVideo: 30,
  minLikes: 0,
  refreshSchedule: "daily"
};

describe("daily crawl task planning", () => {
  test("builds Instagram and TikTok hashtag and creator browser-session tasks from settings", () => {
    const tasks = buildDailyCrawlTasks(settings);

    expect(tasks).toEqual([
      expect.objectContaining({
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        limit: 80
      }),
      expect.objectContaining({
        platform: "instagram",
        mode: "hashtag",
        query: "runway"
      }),
      expect.objectContaining({
        platform: "instagram",
        mode: "account",
        query: "runwayml",
        limit: 12
      }),
      expect.objectContaining({
        platform: "instagram",
        mode: "account",
        query: "heygen_official"
      }),
      expect.objectContaining({
        platform: "tiktok",
        mode: "hashtag",
        query: "aitools"
      }),
      expect.objectContaining({
        platform: "tiktok",
        mode: "account",
        query: "demo"
      })
    ]);
    expect(tasks.every((task) => task.provider === "browser_session")).toBe(true);
    expect(tasks.every((task) => task.filterToKeywords === false)).toBe(true);
    expect(tasks.every((task) => task.sortBy === "latest")).toBe(true);
  });

  test("can build tasks for only one platform", () => {
    const instagramTasks = buildDailyCrawlTasks(settings, { platform: "instagram" });
    const tiktokTasks = buildDailyCrawlTasks(settings, { platform: "tiktok" });

    expect(instagramTasks).toHaveLength(4);
    expect(instagramTasks.every((task) => task.platform === "instagram")).toBe(true);
    expect(instagramTasks.map((task) => task.query)).not.toContain("aitools");
    expect(tiktokTasks).toHaveLength(2);
    expect(tiktokTasks.every((task) => task.platform === "tiktok")).toBe(true);
    expect(tiktokTasks.map((task) => task.query)).toEqual(["aitools", "demo"]);
  });

  test("falls back to the legacy daily limit when split limits are not set", () => {
    const { hashtagCrawlLimit, creatorCrawlLimit, ...legacySettings } = settings;
    void hashtagCrawlLimit;
    void creatorCrawlLimit;

    const tasks = buildDailyCrawlTasks(legacySettings);

    expect(tasks.every((task) => task.limit === 25)).toBe(true);
  });

  test("identifies browser session auth and connection failures as fatal for a run", () => {
    expect(
      isFatalBrowserSessionError(
        "TikTok browser session is not logged in. Open TikTok in the connected browser and log in."
      )
    ).toBe(true);
    expect(
      isFatalBrowserSessionError(
        "Browser session is not connected. Start Chrome/Edge with --remote-debugging-port=9222."
      )
    ).toBe(true);
    expect(isFatalBrowserSessionError("No visible tiktok post/video links found.")).toBe(
      true
    );
    expect(isFatalBrowserSessionError("Daily crawl hashtag failed because one post was private.")).toBe(
      false
    );
  });
});
