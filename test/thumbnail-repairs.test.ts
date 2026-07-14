import { describe, expect, test } from "vitest";
import {
  isUsableThumbnailUrl,
  queueThumbnailRepair,
  repairableThumbnailJobs,
  withRefreshedThumbnail
} from "@/lib/thumbnail-repairs";
import type { SourceItem, ThumbnailRepair } from "@/lib/types";

const source: SourceItem = {
  id: "source_1",
  platform: "instagram",
  externalId: "post_1",
  url: "https://www.instagram.com/p/post_1/",
  authorName: "Creator",
  authorHandle: "creator",
  title: "Test",
  text: "Test",
  hashtags: [],
  language: "en",
  region: "",
  mediaType: "post",
  publishedAt: "2026-07-01T00:00:00.000Z",
  collectedAt: "2026-07-02T00:00:00.000Z",
  metrics: {},
  thumbnailUrl: "https://old.example.com/image.jpg",
  raw: {},
  seeded: false
};

describe("thumbnail repair queue", () => {
  test("deduplicates repeated failure reports by source id", () => {
    const first = queueThumbnailRepair([], source, "2026-07-03T00:00:00.000Z");
    const second = queueThumbnailRepair(first, source, "2026-07-04T00:00:00.000Z");

    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      sourceId: source.id,
      status: "pending",
      reportedAt: "2026-07-03T00:00:00.000Z"
    });
  });

  test("selects pending and failed jobs before repaired jobs", () => {
    const repairs: ThumbnailRepair[] = [
      {
        sourceId: "repaired",
        platform: "instagram",
        sourceUrl: source.url,
        status: "repaired",
        attempts: 1,
        reportedAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z"
      },
      {
        sourceId: "failed",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@creator/video/1",
        status: "failed",
        attempts: 1,
        reportedAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z"
      }
    ];

    expect(repairableThumbnailJobs(repairs)).toHaveLength(1);
    expect(repairableThumbnailJobs(repairs)[0].sourceId).toBe("failed");
  });

  test("refreshes the thumbnail without changing collectedAt", () => {
    const updated = withRefreshedThumbnail(
      source,
      "https://new.example.com/image.jpg"
    );

    expect(updated.thumbnailUrl).toBe("https://new.example.com/image.jpg");
    expect(updated.collectedAt).toBe(source.collectedAt);
  });

  test("rejects placeholders and non-http image values", () => {
    expect(isUsableThumbnailUrl("https://cdn.example.com/image.jpg")).toBe(true);
    expect(isUsableThumbnailUrl("data:image/gif;base64,abc")).toBe(false);
    expect(isUsableThumbnailUrl("https://cdn.example.com/1x1.gif")).toBe(false);
  });
});