import { NextResponse } from "next/server";
import { promoteApprovedCandidates } from "@/lib/collection-candidates";
import {
  readCollectionCandidates,
  readSettings,
  readSourceItems,
  withDataStoreLock,
  writeCollectionCandidates,
  writeSourceItems,
  writeTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";

export const runtime = "nodejs";

export async function POST() {
  const now = new Date().toISOString();
  const { result, topics } = await withDataStoreLock(async () => {
    const [candidates, sources, settings] = await Promise.all([
      readCollectionCandidates(),
      readSourceItems(),
      readSettings()
    ]);
    const result = promoteApprovedCandidates({
      candidates,
      existingSources: sources,
      now
    });
    const updatesById = new Map(result.updated.map((source) => [source.id, source]));
    const updatesByUrl = new Map(result.updated.map((source) => [source.url, source]));
    const nextSources = [
      ...result.promoted,
      ...sources.map((source) => updatesById.get(source.id) || updatesByUrl.get(source.url) || source)
    ];
    const topics = generateTrendTopics(nextSources, settings, now);

    await Promise.all([
      writeCollectionCandidates(result.remainingCandidates),
      writeSourceItems(nextSources),
      writeTrendTopics(topics)
    ]);

    return { result, topics };
  });

  return NextResponse.json({
    promoted: result.promoted.length,
    updated: result.updated.length,
    skipped: result.skipped,
    topics
  });
}
