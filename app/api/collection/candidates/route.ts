import { NextResponse } from "next/server";
import {
  applyCandidatePatch,
  deleteCollectionCandidates,
  filterCollectionCandidates
} from "@/lib/collection-candidates";
import {
  readCollectionCandidates,
  withDataStoreLock,
  writeCollectionCandidates
} from "@/lib/data-store";
import type {
  CollectionCandidateFilters,
  CollectionCandidatePatch
} from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidates = await readCollectionCandidates();
  const filters: CollectionCandidateFilters = {
    platform: (url.searchParams.get("platform") || "all") as CollectionCandidateFilters["platform"],
    status: (url.searchParams.get("status") || "all") as CollectionCandidateFilters["status"],
    keywordMatched: (url.searchParams.get("keywordMatched") || "all") as CollectionCandidateFilters["keywordMatched"],
    seedMode: (url.searchParams.get("seedMode") || "all") as CollectionCandidateFilters["seedMode"],
    seedQuery: url.searchParams.get("seedQuery") || undefined,
    minLikes: url.searchParams.get("minLikes")
      ? Number(url.searchParams.get("minLikes"))
      : undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    duplicateGroup: url.searchParams.get("duplicateGroup") || undefined
  };

  return NextResponse.json({
    candidates: filterCollectionCandidates(candidates, filters),
    total: candidates.length
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as CollectionCandidatePatch;
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const now = new Date().toISOString();
  const selectedCandidates = await withDataStoreLock(async () => {
    const candidates = await readCollectionCandidates();
    const next = applyCandidatePatch(candidates, { ...body, ids }, now);

    await writeCollectionCandidates(next);
    return next.filter((candidate) => ids.includes(candidate.id));
  });

  return NextResponse.json({
    candidates: selectedCandidates
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const deleted = await withDataStoreLock(async () => {
    const candidates = await readCollectionCandidates();
    const next = deleteCollectionCandidates(candidates, ids);

    await writeCollectionCandidates(next);
    return candidates.length - next.length;
  });

  return NextResponse.json({ deleted });
}
