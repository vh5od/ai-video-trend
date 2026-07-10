import { describe, expect, test } from "vitest";
import {
  applyCandidatePatch,
  buildCollectionCandidates,
  deleteCollectionCandidates,
  filterCollectionCandidates,
  promoteApprovedCandidates
} from "@/lib/collection-candidates";
import type { CollectionCandidate, CrawlerTask, SourceItem } from "@/lib/types";

function source(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    id: "src_crawler_instagram_abc",
    platform: "instagram",
    externalId: "abc",
    url: "https://www.instagram.com/reel/abc/",
    authorName: "Creator",
    authorHandle: "creator",
    title: "AI product avatar demo",
    text: "AI product avatar demo",
    hashtags: ["aivideo"],
    language: "en",
    region: "unknown",
    mediaType: "video",
    publishedAt: "2026-07-09T00:00:00.000Z",
    collectedAt: "2026-07-09T01:00:00.000Z",
    metrics: { likes: 1200 },
    raw: {},
    seeded: false,
    ...overrides
  };
}

describe("collection candidate types", () => {
  test("supports pending review metadata before promotion", () => {
    const candidate: CollectionCandidate = {
      id: "cand_instagram_abc",
      status: "pending",
      source: source(),
      seed: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "browser_session"
      },
      review: {
        keywordMatched: true,
        matchedKeywords: ["AI avatar"],
        belowMinLikes: false,
        duplicateOf: undefined,
        candidatePhrases: ["product avatar demo"]
      },
      createdAt: "2026-07-09T01:00:00.000Z",
      updatedAt: "2026-07-09T01:00:00.000Z"
    };

    expect(candidate.status).toBe("pending");
    expect(candidate.review.keywordMatched).toBe(true);
  });
});

const task: CrawlerTask = {
  platform: "instagram",
  mode: "hashtag",
  query: "aivideo",
  provider: "manual_import",
  limit: 50,
  sortBy: "latest",
  filterToKeywords: true,
  items: [
    {
      id: "abc",
      url: "https://www.instagram.com/reel/abc/",
      text: "AI avatar product demo with talking presenter",
      authorHandle: "creator",
      publishedAt: "2026-07-09T00:00:00.000Z",
      likes: 1200
    },
    {
      id: "offtopic",
      url: "https://www.instagram.com/reel/offtopic/",
      text: "Empire building motivation reel",
      authorHandle: "coach",
      publishedAt: "2026-07-09T00:00:00.000Z",
      likes: 5000
    }
  ]
};

function buildCandidates() {
  return buildCollectionCandidates({
    task,
    existingCandidates: [],
    existingSources: [],
    keywords: ["AI avatar"],
    minLikes: 1000,
    now: "2026-07-09T01:00:00.000Z"
  }).candidates;
}

describe("collection candidate builder", () => {
  test("stores crawled items as pending candidates with keyword metadata", () => {
    const result = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    });

    expect(result.invalid).toBe(0);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      status: "pending",
      review: {
        keywordMatched: true,
        matchedKeywords: ["AI avatar"],
        belowMinLikes: false
      }
    });
    expect(result.candidates[1]).toMatchObject({
      status: "pending",
      review: {
        keywordMatched: false,
        matchedKeywords: [],
        belowMinLikes: false
      }
    });
  });

  test("marks duplicate candidates instead of creating dashboard sources", () => {
    const existing = buildCandidates();
    const result = buildCollectionCandidates({
      task,
      existingCandidates: existing,
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T02:00:00.000Z"
    });

    expect(result.candidates[0].status).toBe("duplicate");
    expect(result.candidates[0].review.duplicateOf).toBe(existing[0].id);
  });

  test("matches configured keywords as complete words instead of substrings", () => {
    const result = buildCollectionCandidates({
      task: {
        ...task,
        items: [
          {
            id: "substring",
            url: "https://www.instagram.com/reel/substring/",
            text: "The campaign explains paid media and brand identity.",
            authorHandle: "creator",
            publishedAt: "2026-07-09T00:00:00.000Z",
            likes: 1200
          },
          {
            id: "whole_word",
            url: "https://www.instagram.com/reel/whole_word/",
            text: "The campaign uses AI media for product demos.",
            authorHandle: "creator",
            publishedAt: "2026-07-09T00:00:00.000Z",
            likes: 1200
          }
        ]
      },
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    });

    expect(result.candidates[0].review.keywordMatched).toBe(false);
    expect(result.candidates[1].review.keywordMatched).toBe(true);
  });
});

describe("collection candidate review actions", () => {
  test("approves selected candidates and edits text fields", () => {
    const built = buildCandidates();
    const next = applyCandidatePatch(
      built,
      {
        ids: [built[0].id],
        status: "approved",
        fields: { title: "Edited title" },
        candidatePhrases: ["talking product avatar"]
      },
      "2026-07-09T02:00:00.000Z"
    );

    expect(next[0].status).toBe("approved");
    expect(next[0].source.title).toBe("Edited title");
    expect(next[0].review.candidatePhrases).toEqual(["talking product avatar"]);
  });

  test("deletes selected candidates", () => {
    const built = buildCandidates();
    expect(deleteCollectionCandidates(built, [built[0].id])).toHaveLength(1);
  });

  test("filters candidates by status and keyword match", () => {
    const built = buildCandidates();
    const approved = applyCandidatePatch(
      built,
      {
        ids: [built[0].id],
        status: "approved"
      },
      "2026-07-09T02:00:00.000Z"
    );

    expect(filterCollectionCandidates(approved, { status: "approved" })).toHaveLength(1);
    expect(filterCollectionCandidates(approved, { keywordMatched: "unmatched" })).toHaveLength(1);
  });

  test("promotes approved keyword-matched candidates into sources", () => {
    const built = buildCandidates();
    const approved = applyCandidatePatch(
      built,
      {
        ids: [built[0].id],
        status: "approved"
      },
      "2026-07-09T02:00:00.000Z"
    );

    const result = promoteApprovedCandidates({
      candidates: approved,
      existingSources: [],
      now: "2026-07-09T03:00:00.000Z"
    });

    expect(result.promoted).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.remainingCandidates.find((candidate) => candidate.id === built[0].id)).toBeUndefined();
  });

  test("promotes manually approved unmatched candidates", () => {
    const built = buildCandidates();
    const approved = applyCandidatePatch(
      built,
      {
        ids: [built[1].id],
        status: "approved"
      },
      "2026-07-09T02:00:00.000Z"
    );

    const result = promoteApprovedCandidates({
      candidates: approved,
      existingSources: [],
      now: "2026-07-09T03:00:00.000Z"
    });

    expect(result.promoted.map((item) => item.externalId)).toContain("offtopic");
  });

  test("keeps skipped approved candidates in the inbox for correction", () => {
    const built = buildCandidates();
    const belowMinLikes = applyCandidatePatch(
      [
        {
          ...built[0],
          review: { ...built[0].review, belowMinLikes: true }
        }
      ],
      {
        ids: [built[0].id],
        status: "approved"
      },
      "2026-07-09T02:00:00.000Z"
    );

    const result = promoteApprovedCandidates({
      candidates: belowMinLikes,
      existingSources: [],
      now: "2026-07-09T03:00:00.000Z"
    });

    expect(result.promoted).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.remainingCandidates.map((candidate) => candidate.id)).toEqual([built[0].id]);
  });
});
