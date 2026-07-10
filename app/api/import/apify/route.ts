import { NextResponse } from "next/server";
import { importApifyItems } from "@/lib/apify-importer";
import {
  readCollectionRuns,
  readSettings,
  readSourceItems,
  writeCollectionRuns,
  writeSourceItems,
  writeTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";
import type { CollectionRun } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const items = Array.isArray(body) ? body : body.items;

  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: "Expected an Apify dataset array or { items: [...] }." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const [sources, settings, runs] = await Promise.all([
    readSourceItems(),
    readSettings(),
    readCollectionRuns()
  ]);
  const result = importApifyItems({
    items,
    existingSources: sources,
    settings,
    now,
    filterToKeywords: body.filterToKeywords !== false
  });
  const nextSources = [...result.imported, ...sources];
  const topics = generateTrendTopics(nextSources, settings, now);
  const run: CollectionRun = {
    id: `run_apify_${Date.now()}`,
    platform: "instagram",
    provider: "apify_instagram_scraper",
    status: "ready",
    startedAt: now,
    finishedAt: now,
    itemsFound: items.length,
    itemsStored: result.imported.length,
    message: `Imported ${result.imported.length} Apify Instagram records. Skipped ${result.skippedDuplicates} duplicates, ${result.skippedUnmatched} unmatched, and ${result.skippedInvalid} invalid records.`
  };

  await Promise.all([
    writeSourceItems(nextSources),
    writeTrendTopics(topics),
    writeCollectionRuns([run, ...runs])
  ]);

  return NextResponse.json({ ...result, run, topics });
}
