import { NextResponse } from "next/server";
import {
  readCollectionCandidates,
  readSourceItems,
  readThumbnailRepairs,
  withDataStoreLock,
  writeThumbnailRepairs
} from "@/lib/data-store";
import { queueThumbnailRepair } from "@/lib/thumbnail-repairs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sourceId?: unknown;
    sourceIds?: unknown;
  };
  const requestedIds = [
    ...(Array.isArray(body.sourceIds) ? body.sourceIds : []),
    body.sourceId
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 250);
  const sourceIds = Array.from(new Set(requestedIds));

  if (sourceIds.length === 0) {
    return NextResponse.json({ error: "sourceId or sourceIds is required." }, { status: 400 });
  }

  const queued = await withDataStoreLock(async () => {
    const [sources, candidates, repairs] = await Promise.all([
      readSourceItems(),
      readCollectionCandidates(),
      readThumbnailRepairs()
    ]);
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    for (const candidate of candidates) {
      if (!sourcesById.has(candidate.source.id)) {
        sourcesById.set(candidate.source.id, candidate.source);
      }
    }

    const now = new Date().toISOString();
    const next = sourceIds.reduce((current, sourceId) => {
      const source = sourcesById.get(sourceId);
      return source ? queueThumbnailRepair(current, source, now) : current;
    }, repairs);

    if (next !== repairs) {
      await writeThumbnailRepairs(next);
    }
    return sourceIds.filter((sourceId) => sourcesById.has(sourceId));
  });

  if (queued.length === 0) {
    return NextResponse.json({ error: "Sources not found." }, { status: 404 });
  }

  return NextResponse.json({ queued: queued.length, sourceIds: queued }, { status: 202 });
}