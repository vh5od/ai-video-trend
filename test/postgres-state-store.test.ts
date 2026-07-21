import { afterEach, describe, expect, test, vi } from "vitest";

const calls: Array<{ strings: string[]; values: unknown[] }> = [];
const rowsByKey = new Map<string, unknown>();

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: Array.from(strings), values });
    const statement = strings.join("?");
    if (statement.includes("SELECT value")) {
      const key = String(values[0]);
      return rowsByKey.has(key) ? [{ value: rowsByKey.get(key) }] : [];
    }
    if (statement.includes("INSERT INTO app_state")) {
      rowsByKey.set(
        String(values[0]),
        typeof values[1] === "string" ? JSON.parse(values[1]) : values[1]
      );
      return [];
    }
    return [];
  }
}));

async function loadStore() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://example";
  process.env.AI_VIDEO_TREND_DATA_DIR = "unused-with-database";
  return import("@/lib/data-store");
}

afterEach(() => {
  vi.resetModules();
  calls.length = 0;
  rowsByKey.clear();
  delete process.env.DATABASE_URL;
  delete process.env.AI_VIDEO_TREND_DATA_DIR;
});

describe("postgres app state store", () => {
  test("reads fallback settings from Postgres state when row is missing", async () => {
    const store = await loadStore();

    const settings = await store.readSettings();

    expect(settings.dailyCrawlLimit).toBe(50);
    expect(calls.some((call) => call.strings.join("").includes("CREATE TABLE"))).toBe(true);
    expect(calls.some((call) => call.values.includes("settings"))).toBe(true);
  });

  test("round trips JSON document values through app_state", async () => {
    const store = await loadStore();

    await store.writeTrendTopics([
      {
        id: "trend_ai",
        title: "AI trend",
        summary: "",
        keywords: ["ai"],
        heatScore: 1,
        status: "hot",
        firstSeenAt: "2026-07-13T00:00:00.000Z",
        lastSeenAt: "2026-07-13T00:00:00.000Z",
        sourceCount: 1,
        platformBreakdown: { instagram: 1, tiktok: 0, x: 0 },
        scoreBreakdown: {
          engagement: 1,
          freshness: 1,
          keywordRelevance: 1,
          sourceCount: 1
        },
        sourceIds: ["src_1"]
      }
    ]);

    const topics = await store.readTrendTopics();

    expect(topics).toHaveLength(1);
    expect(topics[0].id).toBe("trend_ai");
    expect(rowsByKey.has("trend-topics")).toBe(true);
  });

  test("sanitizes text that Postgres jsonb cannot represent", async () => {
    const store = await loadStore();

    await store.writeSettings({
      instagramHashtags: ["ai\u0000video", "broken\uD800text"],
      instagramCreators: [],
      tiktokHashtags: [],
      tiktokCreators: [],
      keywords: [],
      dailyCrawlLimit: 10,
      commentsPerVideo: 10,
      minLikes: 0,
      refreshSchedule: "manual"
    });

    const written = rowsByKey.get("settings") as { instagramHashtags: string[] };
    expect(written.instagramHashtags).toEqual(["aivideo", "broken\uFFFDtext"]);
    const insert = calls.find((call) => call.strings.join("").includes("INSERT INTO app_state"));
    expect(insert?.values[1]).not.toContain("\\u0000");
    expect(insert?.values[1]).not.toContain("\\ud800");
  });
});
