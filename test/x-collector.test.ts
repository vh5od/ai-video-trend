import { describe, expect, test } from "vitest";
import { collectXRecentSearch, normalizeXTweet } from "@/lib/x-collector";

describe("X recent search collector", () => {
  test("normalizes an X tweet into a source item", () => {
    const source = normalizeXTweet(
      {
        id: "123",
        text: "Seedance and Kling AI video demos are spreading. #AIVideo",
        author_id: "u1",
        created_at: "2026-07-08T01:00:00.000Z",
        entities: {
          hashtags: [{ tag: "AIVideo" }]
        },
        public_metrics: {
          like_count: 100,
          retweet_count: 20,
          reply_count: 5,
          quote_count: 3,
          impression_count: 9000
        }
      },
      new Map([["u1", { id: "u1", username: "aiwatcher", name: "AI Watcher" }]]),
      "2026-07-08T02:00:00.000Z"
    );

    expect(source.platform).toBe("x");
    expect(source.url).toBe("https://x.com/aiwatcher/status/123");
    expect(source.authorHandle).toBe("aiwatcher");
    expect(source.hashtags).toEqual(["aivideo"]);
    expect(source.metrics).toEqual({
      views: 9000,
      likes: 100,
      comments: 5,
      shares: 23
    });
  });

  test("collects recent search results with bearer token", async () => {
    const calls: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      calls.push(String(input));
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: "123",
              text: "AI video tools are moving fast",
              author_id: "u1",
              created_at: "2026-07-08T01:00:00.000Z",
              public_metrics: {
                like_count: 10,
                retweet_count: 2,
                reply_count: 1,
                quote_count: 1
              }
            }
          ],
          includes: {
            users: [{ id: "u1", username: "builder", name: "Builder" }]
          }
        })
      } as Response;
    };

    const result = await collectXRecentSearch({
      token: "token",
      queries: ["AI video"],
      maxResults: 10,
      now: "2026-07-08T02:00:00.000Z",
      fetchImpl: fakeFetch
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].authorHandle).toBe("builder");
    expect(calls[0]).toContain("https://api.x.com/2/tweets/search/recent");
    expect(new URL(calls[0]).searchParams.get("query")).toBe("AI video");
  });
});
