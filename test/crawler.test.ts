import { describe, expect, test } from "vitest";
import {
  applyCrawlerItemUpdates,
  getCrawlerProviderStatuses,
  importCrawlerItems,
  validateCrawlerTask
} from "@/lib/crawler";
import type { SourceItem } from "@/lib/types";

const existingSource: SourceItem = {
  id: "src_existing",
  platform: "instagram",
  externalId: "existing",
  url: "https://www.instagram.com/reel/existing/",
  authorName: "Existing",
  authorHandle: "existing",
  title: "Existing",
  text: "Existing AI video",
  hashtags: ["aivideo"],
  language: "en",
  region: "unknown",
  mediaType: "video",
  publishedAt: "2026-07-01T00:00:00.000Z",
  collectedAt: "2026-07-01T00:00:00.000Z",
  metrics: {},
  raw: {},
  seeded: false
};

describe("crawler task validation", () => {
  test("accepts a manual Instagram hashtag import task with items", () => {
    const result = validateCrawlerTask({
      platform: "instagram",
      mode: "hashtag",
      query: "#aivideo",
      provider: "manual_import",
      items: [
        {
          url: "https://www.instagram.com/reel/abc/",
          caption: "AI video"
        }
      ]
    });

    expect(result.valid).toBe(true);
    expect(result.task?.query).toBe("aivideo");
    expect(result.task?.limit).toBe(50);
  });

  test("rejects manual import tasks without items", () => {
    const result = validateCrawlerTask({
      platform: "tiktok",
      mode: "keyword",
      query: "ai avatar",
      provider: "manual_import"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Manual import requires an items array.");
  });
});

describe("crawler item import", () => {
  test("imports Instagram provider records and skips duplicates", () => {
    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "manual_import",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            id: "new_ig",
            type: "Video",
            caption: "AI video ad workflow",
            hashtags: ["aivideo"],
            url: "https://www.instagram.com/reel/new_ig/",
            ownerUsername: "creatorlab",
            likesCount: 300,
            videoViewCount: 12000,
            timestamp: "2026-07-01T12:00:00.000Z"
          },
          {
            id: "existing",
            caption: "Duplicate AI video",
            url: "https://www.instagram.com/reel/existing/"
          }
        ]
      },
      existingSources: [existingSource],
      now: "2026-07-08T00:00:00.000Z"
    });

    expect(result.imported).toHaveLength(1);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.imported[0]).toMatchObject({
      platform: "instagram",
      externalId: "new_ig",
      authorHandle: "creatorlab",
      metrics: {
        views: 12000,
        likes: 300
      }
    });
  });

  test("imports TikTok provider records as normalized source items", () => {
    const result = importCrawlerItems({
      task: {
        platform: "tiktok",
        mode: "keyword",
        query: "ai avatar",
        provider: "manual_import",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            videoId: "tt_1",
            desc: "AI avatar product demo",
            webVideoUrl: "https://www.tiktok.com/@demo/video/1",
            authorMeta: { name: "demo", nickName: "Demo Lab" },
            hashtags: [{ name: "aivideo" }],
            playCount: 12000,
            diggCount: 900,
            commentCount: 22,
            shareCount: 40,
            createTimeISO: "2026-07-01T12:00:00.000Z"
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T00:00:00.000Z"
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].platform).toBe("tiktok");
    expect(result.imported[0].externalId).toBe("tt_1");
    expect(result.imported[0].authorHandle).toBe("demo");
    expect(result.imported[0].metrics.views).toBe(12000);
    expect(result.imported[0].hashtags).toEqual(["aivideo"]);
  });

  test("skips unmatched records when keyword filtering is enabled", () => {
    const result = importCrawlerItems({
      task: {
        platform: "tiktok",
        mode: "keyword",
        query: "ai avatar",
        provider: "manual_import",
        limit: 50,
        filterToKeywords: true,
        sortBy: "as_provided",
        items: [
          {
            videoId: "noise",
            desc: "A travel montage from the beach",
            webVideoUrl: "https://www.tiktok.com/@demo/video/noise"
          },
          {
            videoId: "match",
            desc: "AI avatar product demo",
            webVideoUrl: "https://www.tiktok.com/@demo/video/match"
          }
        ]
      },
      existingSources: [],
      keywords: ["AI avatar"],
      now: "2026-07-08T00:00:00.000Z"
    });

    expect(result.imported.map((source) => source.externalId)).toEqual(["match"]);
    expect(result.skippedUnmatched).toBe(1);
  });

  test("sorts by newest source before applying the task limit", () => {
    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "manual_import",
        limit: 1,
        filterToKeywords: false,
        sortBy: "latest",
        items: [
          {
            id: "old",
            caption: "Older AI video",
            url: "https://www.instagram.com/reel/old/",
            timestamp: "2026-07-01T00:00:00.000Z"
          },
          {
            id: "new",
            caption: "Newer AI video",
            url: "https://www.instagram.com/reel/new/",
            timestamp: "2026-07-08T00:00:00.000Z"
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported.map((source) => source.externalId)).toEqual(["new"]);
  });

  test("sorts by highest heat before applying the task limit", () => {
    const result = importCrawlerItems({
      task: {
        platform: "tiktok",
        mode: "keyword",
        query: "ai video",
        provider: "manual_import",
        limit: 1,
        filterToKeywords: false,
        sortBy: "highest_heat",
        items: [
          {
            videoId: "low",
            desc: "Low engagement AI video",
            webVideoUrl: "https://www.tiktok.com/@demo/video/low",
            playCount: 100,
            diggCount: 5,
            commentCount: 1,
            shareCount: 0
          },
          {
            videoId: "hot",
            desc: "High engagement AI video",
            webVideoUrl: "https://www.tiktok.com/@demo/video/hot",
            playCount: 50000,
            diggCount: 3000,
            commentCount: 400,
            shareCount: 200
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported.map((source) => source.externalId)).toEqual(["hot"]);
  });

  test("skips records below the minimum likes threshold", () => {
    const result = importCrawlerItems({
      task: {
        platform: "tiktok",
        mode: "hashtag",
        query: "aivideo",
        provider: "manual_import",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            videoId: "low_likes",
            desc: "AI architecture workflow",
            webVideoUrl: "https://www.tiktok.com/@demo/video/low_likes",
            diggCount: 49
          },
          {
            videoId: "enough_likes",
            desc: "AI architecture workflow",
            webVideoUrl: "https://www.tiktok.com/@demo/video/enough_likes",
            diggCount: 50
          }
        ]
      },
      existingSources: [],
      minLikes: 50,
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported.map((source) => source.externalId)).toEqual([
      "enough_likes"
    ]);
    expect(result.skippedBelowMinLikes).toBe(1);
  });

  test("does not treat unknown likes as below the minimum likes threshold", () => {
    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "manual_import",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            id: "unknown_likes",
            caption: "AI video candidate with hidden like count",
            url: "https://www.instagram.com/reel/unknown_likes/"
          }
        ]
      },
      existingSources: [],
      minLikes: 100,
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported.map((source) => source.externalId)).toEqual([
      "unknown_likes"
    ]);
    expect(result.skippedBelowMinLikes).toBe(0);
  });

  test("refreshes duplicate browser-session records when new metadata is better", () => {
    const staleSource: SourceItem = {
      ...existingSource,
      id: "src_crawler_instagram_stale",
      externalId: "stale",
      url: "https://www.instagram.com/p/stale/",
      authorName: "p",
      authorHandle: "p",
      title: "https://www.instagram.com/p/stale/",
      text: "https://www.instagram.com/p/stale/",
      metrics: {}
    };

    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "browser_session",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            id: "stale",
            text: "AI video production workflow",
            url: "https://www.instagram.com/p/stale/",
            authorId: "123456",
            authorName: "Creator Lab",
            authorHandle: "creator.lab",
            publishedAt: "2026-07-07T08:30:00.000Z",
            likes: 1200,
            commentsCount: 44
          }
        ]
      },
      existingSources: [staleSource],
      now: "2026-07-08T01:00:00.000Z"
    });

    const nextSources = applyCrawlerItemUpdates([staleSource], result.updated);

    expect(result.imported).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(nextSources[0]).toMatchObject({
      authorName: "Creator Lab",
      authorId: "123456",
      authorHandle: "creator.lab",
      text: "AI video production workflow",
      publishedAt: "2026-07-07T08:30:00.000Z",
      metrics: {
        likes: 1200,
        comments: 44
      }
    });
  });

  test("rejects browser-session Instagram items without verified author and publish time", () => {
    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "browser_session",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            id: "unverified",
            text: "AI video production workflow",
            url: "https://www.instagram.com/p/unverified/",
            authorName: "Maybe Creator",
            authorHandle: "",
            likes: 1200
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported).toHaveLength(0);
    expect(result.skippedInvalid).toBe(1);
  });

  test("imports browser-session Instagram items with verified author and publish time", () => {
    const result = importCrawlerItems({
      task: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "browser_session",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            id: "verified",
            text: "AI video production workflow",
            url: "https://www.instagram.com/p/verified/",
            authorId: "123456",
            authorName: "Creator Lab",
            authorHandle: "creator.lab",
            publishedAt: "2026-07-07T08:30:00.000Z",
            likes: 1200
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]).toMatchObject({
      authorId: "123456",
      authorHandle: "creator.lab",
      publishedAt: "2026-07-07T08:30:00.000Z"
    });
  });

  test("derives TikTok browser-session publish time from the video id", () => {
    const result = importCrawlerItems({
      task: {
        platform: "tiktok",
        mode: "keyword",
        query: "ai video",
        provider: "browser_session",
        limit: 50,
        filterToKeywords: false,
        sortBy: "as_provided",
        items: [
          {
            text: "AI video production workflow",
            url: "https://www.tiktok.com/@realcreator/video/7659700510261248000",
            authorName: "Real Creator",
            authorHandle: "realcreator"
          }
        ]
      },
      existingSources: [],
      now: "2026-07-08T01:00:00.000Z"
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]).toMatchObject({
      authorHandle: "realcreator",
      publishedAt: "2026-07-07T08:30:00.000Z"
    });
  });
});

describe("crawler provider statuses", () => {
  test("reports manual import ready and browser session partial", () => {
    const statuses = getCrawlerProviderStatuses({});
    const instagramManual = statuses.find(
      (status) =>
        status.platform === "instagram" && status.provider === "manual_import"
    );
    const tiktokBrowser = statuses.find(
      (status) =>
        status.platform === "tiktok" && status.provider === "browser_session"
    );

    expect(instagramManual?.status).toBe("ready");
    expect(tiktokBrowser?.status).toBe("partial");
  });
});
