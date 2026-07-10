import { describe, expect, test } from "vitest";
import type { Settings, SourceItem } from "@/lib/types";
import { generateTrendTopics, matchesConfiguredKeywordText } from "@/lib/trend-engine";

const settings: Settings = {
  instagramHashtags: ["aivideo", "aiads", "runway"],
  instagramCreators: [],
  tiktokHashtags: [],
  tiktokCreators: [],
  keywords: ["AI avatar", "AI ads", "Runway", "image to video"],
  dailyCrawlLimit: 50,
  commentsPerVideo: 30,
  minLikes: 0,
  refreshSchedule: "manual"
};

const baseSource: SourceItem = {
  id: "source_1",
  platform: "instagram",
  externalId: "external_1",
  url: "https://www.instagram.com/reel/1/",
  authorName: "Creator",
  authorHandle: "creator",
  title: "AI avatar ad",
  text: "AI avatar ads are getting strong results for ecommerce short videos.",
  hashtags: ["aiavatar", "aiads"],
  language: "en",
  region: "US",
  mediaType: "reel",
  publishedAt: "2026-06-30T08:00:00.000Z",
  collectedAt: "2026-06-30T10:00:00.000Z",
  metrics: {
    views: 100000,
    likes: 9000,
    comments: 400,
    shares: 800
  },
  raw: {},
  seeded: true
};

describe("trend generation", () => {
  test("matches configured keywords as complete words in trend relevance", () => {
    expect(matchesConfiguredKeywordText("paid media prompt workflow", "AI")).toBe(false);
    expect(matchesConfiguredKeywordText("AI media prompt workflow", "AI")).toBe(true);
    expect(matchesConfiguredKeywordText("image to video workflow", "image to video")).toBe(true);
  });

  test("groups sources by repeated phrases beyond configured search keywords", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "source_2",
          externalId: "external_2",
          url: "https://www.instagram.com/reel/2/",
          title: "Miniature city reveal",
          text: "Miniature city transition is getting attention across Reels.",
          hashtags: ["architecture"],
          metrics: {
            views: 45000,
            likes: 2800,
            comments: 100,
            shares: 160
          }
        },
        {
          ...baseSource,
          id: "source_3",
          externalId: "external_3",
          url: "https://www.instagram.com/reel/3/",
          title: "Behind the building shot",
          text: "People keep asking how this miniature city transition was made.",
          hashtags: ["filmmaking"]
        }
      ],
      {
        ...settings,
        keywords: ["AI video", "Runway", "Sora"]
      },
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics[0].title).toBe("Miniature City Transition");
    expect(topics[0].sourceIds).toEqual(["source_2", "source_3"]);
    expect(topics[0].keywords).toContain("miniature city transition");
  });

  test("does not create topics from one-off non-repeated captions", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "source_unmatched",
          title: "Weeknight cooking reel",
          text: "A cooking reel with no technology trend signal.",
          hashtags: ["food"]
        }
      ],
      settings,
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics).toEqual([]);
  });

  test("does not group normal video captions as Veo model trends", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "source_normal_video",
          title: "Museum video",
          text: "You do not have to give out love to prove anything.",
          hashtags: []
        }
      ],
      {
        ...settings,
        keywords: ["Veo"]
      },
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics).toEqual([]);
  });

  test("turns repeated AI video phrases into a human readable trend narrative", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "avatar_ads",
          title: "AI avatar ad workflow",
          text: "AI avatar UGC ads are spreading across short video campaigns.",
          hashtags: ["aiavatar", "aiads", "ugc", "aivideo"]
        },
        {
          ...baseSource,
          id: "avatar_ugc",
          title: "Virtual creator ad",
          text: "Brands are testing AI UGC videos with virtual presenters.",
          hashtags: ["aiavatar", "aiugc", "aiads"]
        }
      ],
      settings,
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics[0].title).toBe("AI Avatar UGC Ads");
    expect(topics[0].summary).toContain("AI avatar");
    expect(topics[0].summary).toContain("UGC");
    expect(topics[0].summary).toContain("ads");
  });

  test("merges sources that share the same repeated trend phrase", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "ai_video_group",
          text: "AI video UGC ads with virtual presenters are spreading.",
          hashtags: ["aivideo", "aiavatar", "ugc", "aiads"]
        },
        {
          ...baseSource,
          id: "avatar_group",
          text: "AI avatar UGC ads are spreading.",
          hashtags: ["aiavatar", "ugc", "aiads"]
        }
      ],
      settings,
      "2026-06-30T12:00:00.000Z"
    );

    const avatarTopics = topics.filter((topic) => topic.title === "AI Avatar UGC Ads");
    expect(avatarTopics).toHaveLength(1);
    expect(avatarTopics[0].sourceCount).toBe(2);
  });

  test("counts Instagram and X sources separately in platform breakdown", () => {
    const topics = generateTrendTopics(
      [
        baseSource,
        {
          ...baseSource,
          id: "x_source",
          platform: "x",
          text: "AI avatar ads are being discussed on X.",
          url: "https://x.com/example/status/1"
        }
      ],
      settings,
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics[0].platformBreakdown.instagram).toBe(1);
    expect(topics[0].platformBreakdown.x).toBe(1);
  });

  test("uses repeated comment text as a trend signal", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "comment_signal",
          externalId: "comment_signal",
          url: "https://www.instagram.com/reel/comment_signal/",
          title: "Building reveal",
          text: "A cinematic architecture video.",
          hashtags: ["architecture"],
          comments: [
            "This looks like AI video.",
            "The camera move feels like Runway."
          ]
        },
        {
          ...baseSource,
          id: "comment_signal_2",
          externalId: "comment_signal_2",
          url: "https://www.instagram.com/reel/comment_signal_2/",
          title: "City reveal",
          text: "Another architecture video.",
          hashtags: ["architecture"],
          comments: [
            "This looks like AI video.",
            "People are asking about the same camera move."
          ]
        }
      ],
      {
        ...settings,
        keywords: ["AI video", "Runway"]
      },
      "2026-06-30T12:00:00.000Z"
    );

    expect(topics).toHaveLength(1);
    expect(topics[0].keywords).toContain("looks like ai video");
    expect(topics[0].scoreBreakdown.keywordRelevance).toBeGreaterThan(0);
  });

  test("does not emit generic engagement phrases as trends", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "src_generic_1",
          text: "Comment follow us for the full breakdown link in bio.",
          comments: ["Subscribe for more.", "Drop comment."]
        },
        {
          ...baseSource,
          id: "src_generic_2",
          externalId: "generic_2",
          url: "https://www.tiktok.com/@demo/video/2",
          text: "Follow us and comment for free link.",
          comments: ["Full breakdown please."]
        }
      ],
      settings,
      "2026-07-09T00:00:00.000Z"
    );

    const titles = topics.map((topic) => topic.title.toLowerCase()).join(" ");
    expect(titles).not.toContain("follow us");
    expect(titles).not.toContain("full breakdown");
    expect(titles).not.toContain("drop comment");
  });

  test("does not emit connector-only prompt phrases as trends", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "src_connector_1",
          text: "Comment for the prompt and follow for more.",
          comments: ["For the prompt please."]
        },
        {
          ...baseSource,
          id: "src_connector_2",
          externalId: "connector_2",
          url: "https://www.instagram.com/reel/connector_2/",
          text: "Try the prompt and check the pinned comment.",
          comments: ["Prompt for more."]
        }
      ],
      { ...settings, keywords: [] },
      "2026-07-09T00:00:00.000Z"
    );

    const keywords = topics.flatMap((topic) => topic.keywords);
    expect(keywords).not.toContain("for the prompt");
    expect(keywords).not.toContain("and prompt");
    expect(keywords).not.toContain("prompt for");
  });

  test("emits repeated meaningful phrases beyond configured keywords", () => {
    const topics = generateTrendTopics(
      [
        {
          ...baseSource,
          id: "src_phrase_1",
          text: "AI avatar ad using talking product avatar for skincare.",
          comments: ["Talking product avatar looks useful."]
        },
        {
          ...baseSource,
          id: "src_phrase_2",
          externalId: "phrase_2",
          url: "https://www.tiktok.com/@demo/video/3",
          text: "Runway test with talking product avatar hook.",
          comments: ["Talking product avatar template please."]
        }
      ],
      { ...settings, keywords: ["AI avatar", "Runway"] },
      "2026-07-09T00:00:00.000Z"
    );

    expect(topics[0].keywords).toContain("talking product avatar");
  });
});
