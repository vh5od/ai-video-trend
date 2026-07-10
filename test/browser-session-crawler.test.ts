import { describe, expect, test } from "vitest";
import {
  buildBrowserSessionUrl,
  collectBrowserSessionItems,
  detectBrowserSessionBlock,
  parseBrowserDetailMetadata,
  withTimeout
} from "@/lib/browser-session-crawler";
import type { CrawlerTask } from "@/lib/types";

function task(input: Partial<CrawlerTask>): CrawlerTask {
  return {
    platform: "instagram",
    mode: "hashtag",
    query: "aivideo",
    provider: "browser_session",
    limit: 10,
    sortBy: "latest",
    filterToKeywords: false,
    ...input
  };
}

describe("browser session crawler URL builder", () => {
  test("builds Instagram hashtag and account URLs", () => {
    expect(
      buildBrowserSessionUrl(
        task({ platform: "instagram", mode: "hashtag", query: "ai video" })
      )
    ).toBe("https://www.instagram.com/explore/tags/aivideo/");

    expect(
      buildBrowserSessionUrl(
        task({ platform: "instagram", mode: "account", query: "@creator.lab" })
      )
    ).toBe("https://www.instagram.com/creator.lab/");
  });

  test("builds TikTok keyword and account URLs", () => {
    expect(
      buildBrowserSessionUrl(
        task({ platform: "tiktok", mode: "keyword", query: "ai avatar" })
      )
    ).toBe("https://www.tiktok.com/search?q=ai+avatar");

    expect(
      buildBrowserSessionUrl(
        task({ platform: "tiktok", mode: "account", query: "@demo" })
      )
    ).toBe("https://www.tiktok.com/@demo");
  });
});

describe("browser session item collection", () => {
  test("rejects stalled browser operations with a timeout", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 1, "browser command timed out")
    ).rejects.toThrow("browser command timed out");
  });

  test("collects visible page items through an injected browser client", async () => {
    const result = await collectBrowserSessionItems({
      task: task({
        platform: "tiktok",
        mode: "keyword",
        query: "ai avatar",
        limit: 2
      }),
      client: {
        collectVisibleItems: async ({ url, limit }) => {
          expect(url).toBe("https://www.tiktok.com/search?q=ai+avatar");
          expect(limit).toBe(2);
          return [
            {
              url: "https://www.tiktok.com/@demo/video/1",
              text: "AI avatar product demo",
              authorHandle: "demo"
            }
          ];
        }
      }
    });

    expect(result.items).toEqual([
      {
        url: "https://www.tiktok.com/@demo/video/1",
        text: "AI avatar product demo",
        authorHandle: "demo"
      }
    ]);
  });

  test("keeps Instagram browser session collection on the page extraction path", async () => {
    const result = await collectBrowserSessionItems({
      task: task({
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        limit: 1
      }),
      client: {
        collectVisibleItems: async () => [
          {
            url: "https://www.instagram.com/reel/ABC123/",
            text: "browser guessed caption",
            authorHandle: "wrong",
            publishedAt: "2026-07-09T02:40:16.825Z"
          }
        ]
      }
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        url: "https://www.instagram.com/reel/ABC123/",
        text: "browser guessed caption",
        authorHandle: "wrong",
        publishedAt: "2026-07-09T02:40:16.825Z"
      })
    ]);
  });
});

describe("browser session detail metadata parser", () => {
  test("parses Instagram detail metadata without treating /p/ as an author", () => {
    const item = parseBrowserDetailMetadata({
      platform: "instagram",
      url: "https://www.instagram.com/p/DW4GLhIjOA4/",
      title: "Instagram photo by creator.lab",
      description:
        '12K likes, 345 comments - creator.lab on July 8, 2026: "AI avatar product workflow #aivideo"',
      image: "https://cdn.example.com/preview.jpg"
    });

    expect(item).toMatchObject({
      url: "https://www.instagram.com/p/DW4GLhIjOA4/",
      text: "AI avatar product workflow #aivideo",
      authorHandle: "creator.lab",
      authorName: "creator.lab",
      likes: 12000,
      commentsCount: 345,
      thumbnailUrl: "https://cdn.example.com/preview.jpg"
    });
    expect(item.authorHandle).not.toBe("p");
  });

  test("prefers Instagram structured author candidates when meta omits the username", () => {
    const item = parseBrowserDetailMetadata({
      platform: "instagram",
      url: "https://www.instagram.com/p/DYmkI1bDI6Q/",
      title: "Comment Prompt #ai #prompt",
      description: "Comment Prompt #ai #prompt",
      publishedAt: "2026-07-07T08:30:00.000Z",
      authorCandidates: [
        {
          handle: "real_creator",
          name: "Real Creator"
        }
      ]
    });

    expect(item).toMatchObject({
      authorName: "Real Creator",
      authorHandle: "real_creator",
      publishedAt: "2026-07-07T08:30:00.000Z",
      text: "Comment Prompt #ai #prompt"
    });
  });

  test("does not guess Instagram author from unrelated profile links", () => {
    const item = parseBrowserDetailMetadata({
      platform: "instagram",
      url: "https://www.instagram.com/p/DYmkI1bDI6Q/",
      title: "Comment Prompt #ai #prompt",
      profileLinks: [
        {
          href: "https://www.instagram.com/creator.lab/",
          text: "Creator Lab"
        }
      ]
    });

    expect(item.authorName).toBeUndefined();
    expect(item.authorHandle).toBeUndefined();
  });

  test("extracts Instagram owner and publish time from structured script text", () => {
    const item = parseBrowserDetailMetadata({
      platform: "instagram",
      url: "https://www.instagram.com/p/DYmkI1bDI6Q/",
      title: "Comment Prompt #ai #prompt",
      description: "Comment Prompt #ai #prompt",
      bodyText:
        '{"shortcode":"DYmkI1bDI6Q","owner":{"username":"true_creator","full_name":"True Creator"},"taken_at_timestamp":1783413000}'
    });

    expect(item.authorName).toBe("True Creator");
    expect(item.authorHandle).toBe("true_creator");
    expect(item.publishedAt).toBe("2026-07-07T08:30:00.000Z");
  });

  test("parses TikTok detail metadata with creator and engagement", () => {
    const item = parseBrowserDetailMetadata({
      platform: "tiktok",
      url: "https://www.tiktok.com/@runwayml/video/7659700510261248000",
      description:
        '123.4K Likes, 456 Comments. TikTok video from Runway (@runwayml): "Text prompt video demo #aivideo".',
      image: "https://cdn.example.com/tiktok.jpg"
    });

    expect(item).toMatchObject({
      text: "Text prompt video demo #aivideo",
      authorName: "Runway",
      authorHandle: "runwayml",
      publishedAt: "2026-07-07T08:30:00.000Z",
      likes: 123400,
      commentsCount: 456,
      thumbnailUrl: "https://cdn.example.com/tiktok.jpg"
    });
  });

  test("parses TikTok engagement when labels appear before numbers", () => {
    const item = parseBrowserDetailMetadata({
      platform: "tiktok",
      url: "https://www.tiktok.com/@runwayml/video/123",
      description: "Text prompt video demo #aivideo",
      engagementText: "Like 12.3K Comment 456 Share 78"
    });

    expect(item.likes).toBe(12300);
    expect(item.commentsCount).toBe(456);
    expect(item.shares).toBe(78);
  });

  test("prefers TikTok numeric metrics extracted from page data", () => {
    const item = parseBrowserDetailMetadata({
      platform: "tiktok",
      url: "https://www.tiktok.com/@runwayml/video/123",
      description: "Text prompt video demo #aivideo",
      likes: 1200,
      commentsCount: 34,
      shares: 5,
      views: 99000
    });

    expect(item).toMatchObject({
      likes: 1200,
      commentsCount: 34,
      shares: 5,
      views: 99000
    });
  });

  test("does not use TikTok default page title as a caption", () => {
    const item = parseBrowserDetailMetadata({
      platform: "tiktok",
      url: "https://www.tiktok.com/@runwayml/video/123",
      title: "TikTok - Make Your Day",
      description: ""
    });

    expect(item.text).toBe("");
  });
});

describe("browser session auth blocker detection", () => {
  test("flags login and verification pages before opening every seed", () => {
    expect(
      detectBrowserSessionBlock({
        platform: "tiktok",
        currentUrl: "https://www.tiktok.com/login",
        title: "Log in | TikTok",
        bodyText: "Log in to TikTok to continue"
      })
    ).toContain("TikTok browser session is not logged in");

    expect(
      detectBrowserSessionBlock({
        platform: "instagram",
        currentUrl: "https://www.instagram.com/challenge/",
        title: "Security check",
        bodyText: "Help us confirm you own this account"
      })
    ).toContain("Instagram browser session is blocked by login or verification");
  });
});
