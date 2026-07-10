import { NextResponse } from "next/server";
import { getInstagramCollectorStatus } from "@/lib/collectors";
import { getCrawlerProviderStatuses } from "@/lib/crawler";
import {
  readCollectionCandidates,
  readCollectionRuns,
  readSourceItems
} from "@/lib/data-store";

export const runtime = "nodejs";

export async function GET() {
  const [runs, sources, candidates] = await Promise.all([
    readCollectionRuns(),
    readSourceItems(),
    readCollectionCandidates()
  ]);
  const latestRun = [...runs].sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt)
  )[0];

  return NextResponse.json({
    instagram: getInstagramCollectorStatus(),
    crawlerProviders: getCrawlerProviderStatuses(),
    latestRun,
    sourceCount: sources.filter((source) => source.platform === "instagram").length,
    candidateCounts: {
      pending: candidates.filter((candidate) => candidate.status === "pending").length,
      approved: candidates.filter((candidate) => candidate.status === "approved").length,
      rejected: candidates.filter((candidate) => candidate.status === "rejected").length,
      duplicate: candidates.filter((candidate) => candidate.status === "duplicate").length
    },
    runs
  });
}
