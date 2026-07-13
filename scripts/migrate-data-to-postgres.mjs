import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required to migrate local JSON data to Postgres.");
  process.exit(1);
}

const dataDir = process.env.AI_VIDEO_TREND_DATA_DIR || path.join(process.cwd(), "data");
const sql = neon(databaseUrl);

const files = [
  ["settings", "settings.json", defaultSettings()],
  ["source-items", "source-items.json", []],
  ["trend-topics", "trend-topics.json", []],
  ["collection-runs", "collection-runs.json", []],
  ["collection-candidates", "collection-candidates.json", []]
];

await sql`
  CREATE TABLE IF NOT EXISTS app_state (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

for (const [key, fileName, fallback] of files) {
  const value = await readLocalJson(fileName, fallback);
  await sql`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  console.log(`Migrated ${fileName} -> app_state.${key}`);
}

function defaultSettings() {
  return {
    instagramHashtags: [],
    instagramCreators: [],
    tiktokHashtags: [],
    tiktokCreators: [],
    keywords: [],
    dailyCrawlLimit: 50,
    hashtagCrawlLimit: 50,
    creatorCrawlLimit: 50,
    commentsPerVideo: 30,
    minLikes: 0,
    refreshSchedule: "manual"
  };
}

async function readLocalJson(fileName, fallback) {
  try {
    const raw = await readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}
