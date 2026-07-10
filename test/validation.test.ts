import { describe, expect, test } from "vitest";
import {
  normalizeManualSeed,
  normalizeManualXSeed,
  validateManualSeed,
  validateManualXSeed
} from "@/lib/validation";

describe("manual Instagram seed validation", () => {
  test("requires a URL and caption text", () => {
    const result = validateManualSeed({ url: "", text: "" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Instagram URL is required.");
    expect(result.errors).toContain("Caption or text is required.");
  });

  test("normalizes hashtags and defaults the platform to Instagram", () => {
    const item = normalizeManualSeed(
      {
        url: "https://www.instagram.com/reel/example/",
        text: "A new AI avatar workflow for ads",
        authorHandle: "@creator",
        hashtags: "#AIAvatar, aiads #UGC",
        views: "12000",
        likes: "340",
        comments: "25",
        shares: "18"
      },
      "2026-06-30T10:00:00.000Z"
    );

    expect(item.platform).toBe("instagram");
    expect(item.authorHandle).toBe("creator");
    expect(item.hashtags).toEqual(["aiavatar", "aiads", "ugc"]);
    expect(item.metrics).toEqual({
      views: 12000,
      likes: 340,
      comments: 25,
      shares: 18
    });
    expect(item.seeded).toBe(true);
  });

  test("keeps optional thumbnail, video, and embed URLs for source previews", () => {
    const item = normalizeManualSeed(
      {
        url: "https://www.instagram.com/reel/media-example/",
        text: "AI video preview with a thumbnail",
        thumbnailUrl: "https://example.com/thumb.jpg",
        videoUrl: "https://example.com/preview.mp4",
        embedUrl: "https://www.instagram.com/reel/media-example/embed/"
      },
      "2026-06-30T10:00:00.000Z"
    );

    expect(item.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(item.videoUrl).toBe("https://example.com/preview.mp4");
    expect(item.embedUrl).toBe("https://www.instagram.com/reel/media-example/embed/");
  });
});

describe("manual X seed validation", () => {
  test("requires a post URL and post text", () => {
    const result = validateManualXSeed({ url: "", text: "" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("X post URL is required.");
    expect(result.errors).toContain("Post text is required.");
  });

  test("normalizes an X post source with engagement metrics", () => {
    const item = normalizeManualXSeed(
      {
        url: "https://x.com/example/status/123",
        text: "Seedance and Kling AI video demos are spreading fast.",
        authorHandle: "@aiwatcher",
        likes: "1200",
        reposts: "320",
        replies: "44",
        views: "88000"
      },
      "2026-07-01T12:00:00.000Z"
    );

    expect(item.platform).toBe("x");
    expect(item.authorHandle).toBe("aiwatcher");
    expect(item.mediaType).toBe("post");
    expect(item.metrics).toEqual({
      views: 88000,
      likes: 1200,
      comments: 44,
      shares: 320
    });
    expect(item.seeded).toBe(true);
  });
});
