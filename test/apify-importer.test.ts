import { describe, expect, test } from "vitest";
import {
  mapApifyItemToSource,
  importApifyItems,
  matchesKeywords
} from "@/lib/apify-importer";
import type { Settings, SourceItem } from "@/lib/types";

const settings: Settings = {
  instagramHashtags: ["aivideo"],
  instagramCreators: [],
  tiktokHashtags: [],
  tiktokCreators: [],
  keywords: ["AI video", "AI ads", "Runway"],
  dailyCrawlLimit: 50,
  commentsPerVideo: 30,
  minLikes: 0,
  refreshSchedule: "manual"
};

const existing: SourceItem = {
  id: "src_existing",
  platform: "instagram",
  externalId: "existing",
  url: "https://www.instagram.com/p/existing/",
  authorName: "Existing",
  authorHandle: "existing",
  title: "Existing source",
  text: "Existing AI video",
  hashtags: ["aivideo"],
  language: "en",
  region: "unknown",
  mediaType: "video",
  publishedAt: "2026-06-30T00:00:00.000Z",
  collectedAt: "2026-06-30T00:00:00.000Z",
  metrics: {},
  raw: {},
  seeded: false
};

describe("Apify Instagram importer", () => {
  test("maps an Apify reel item to a source item with media and metrics", () => {
    const source = mapApifyItemToSource(
      {
        id: "374",
        type: "Video",
        shortCode: "abc123",
        caption: "Runway AI video ads are trending",
        hashtags: ["runway", "aivideo"],
        url: "https://www.instagram.com/reel/abc123/",
        commentsCount: 12,
        displayUrl: "https://example.com/thumb.jpg",
        videoUrl: "https://example.com/video.mp4",
        likesCount: 300,
        videoViewCount: 12000,
        timestamp: "2026-06-30T10:00:00.000Z",
        ownerFullName: "Creator Lab",
        ownerUsername: "creatorlab"
      },
      "2026-07-01T00:00:00.000Z"
    );

    expect(source.id).toBe("src_apify_instagram_374");
    expect(source.externalId).toBe("374");
    expect(source.text).toBe("Runway AI video ads are trending");
    expect(source.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(source.videoUrl).toBe("https://example.com/video.mp4");
    expect(source.metrics).toEqual({
      views: 12000,
      likes: 300,
      comments: 12,
      shares: undefined
    });
  });

  test("imports only keyword-matched, non-duplicate items by default", () => {
    const result = importApifyItems({
      items: [
        {
          id: "new_ai",
          caption: "Fresh AI video example",
          hashtags: ["aivideo"],
          url: "https://www.instagram.com/p/new_ai/",
          timestamp: "2026-06-30T10:00:00.000Z"
        },
        {
          id: "noise",
          caption: "A travel photo with no relevant signal",
          hashtags: [],
          url: "https://www.instagram.com/p/noise/",
          timestamp: "2026-06-30T10:00:00.000Z"
        },
        {
          id: "existing",
          caption: "Existing AI video",
          hashtags: ["aivideo"],
          url: "https://www.instagram.com/p/existing/",
          timestamp: "2026-06-30T10:00:00.000Z"
        }
      ],
      existingSources: [existing],
      settings,
      now: "2026-07-01T00:00:00.000Z",
      filterToKeywords: true
    });

    expect(result.imported).toHaveLength(1);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.skippedUnmatched).toBe(1);
  });

  test("does not match short model names inside unrelated words", () => {
    expect(
      matchesKeywords(
        {
          caption: "I chose to make this video because the exhibit was beautiful.",
          hashtags: []
        },
        ["Veo"]
      )
    ).toBe(false);

    expect(
      matchesKeywords(
        {
          caption: "You do not have to give out love to prove anything.",
          hashtags: []
        },
        ["Veo"]
      )
    ).toBe(false);

    expect(
      matchesKeywords(
        {
          caption: "Testing Veo for cinematic AI video ads.",
          hashtags: []
        },
        ["Veo"]
      )
    ).toBe(true);
  });
});
