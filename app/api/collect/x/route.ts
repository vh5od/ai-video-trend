import { NextResponse } from "next/server";
import {
  readCollectionRuns,
  readSettings,
  readSourceItems,
  writeCollectionRuns,
  writeSourceItems,
  writeTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";
import type { CollectionRun, SourceItem } from "@/lib/types";
import { collectXRecentSearch } from "@/lib/x-collector";

export const runtime = "nodejs";

const defaultQueries = [
  '"AI video" OR "text to video" OR "image to video"',
  'Seedance OR "Kling AI" OR Runway OR Pika OR Veo OR Sora',
  '"AI avatar" "AI ads"',
  '"AI UGC" OR "faceless videos"'
];

export async function POST(request: Request) {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Missing X_BEARER_TOKEN. Add it to .env.local, then restart the dev server."
      },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const queries = Array.isArray(body.queries) && body.queries.length > 0
    ? body.queries.map(String)
    : defaultQueries;
  const maxResults = Number(body.maxResults ?? 10);
  const now = new Date().toISOString();
  const [sources, settings, runs] = await Promise.all([
    readSourceItems(),
    readSettings(),
    readCollectionRuns()
  ]);
  const existing = new Set(sources.map((source) => `${source.platform}:${source.externalId}`));
  const result = await collectXRecentSearch({
    token,
    queries,
    maxResults,
    now
  });
  const imported = result.sources.filter(
    (source) => !existing.has(`${source.platform}:${source.externalId}`)
  );
  const nextSources: SourceItem[] = [...imported, ...sources];
  const topics = generateTrendTopics(nextSources, settings, now);
  const run: CollectionRun = {
    id: `run_x_${Date.now()}`,
    platform: "x",
    provider: "x_recent_search",
    status: "ready",
    startedAt: now,
    finishedAt: now,
    itemsFound: result.sources.length,
    itemsStored: imported.length,
    message: `Collected ${result.sources.length} X posts and stored ${imported.length} new records.`
  };

  await Promise.all([
    writeSourceItems(nextSources),
    writeTrendTopics(topics),
    writeCollectionRuns([run, ...runs])
  ]);

  return NextResponse.json({
    run,
    imported,
    found: result.sources.length,
    skippedDuplicates: result.sources.length - imported.length
  });
}
