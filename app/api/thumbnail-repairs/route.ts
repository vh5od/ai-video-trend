import { NextResponse } from "next/server";
import { collectBrowserSessionDetails } from "@/lib/browser-session-crawler";
import {
  readCollectionCandidates,
  readSourceItems,
  readThumbnailRepairs,
  withDataStoreLock,
  writeCollectionCandidates,
  writeSourceItems,
  writeThumbnailRepairs
} from "@/lib/data-store";
import { isFatalBrowserSessionError } from "@/lib/daily-crawl";
import {
  browserSessionUnavailableMessage,
  isCloudBrowserSessionUnavailable
} from "@/lib/deployment";
import {
  isUsableThumbnailUrl,
  repairableThumbnailJobs,
  withRefreshedThumbnail
} from "@/lib/thumbnail-repairs";
import type { ThumbnailRepair } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const repairs = await readThumbnailRepairs();
  return NextResponse.json({
    repairs,
    counts: countStatuses(repairs)
  });
}

export async function POST(request: Request) {
  if (isCloudBrowserSessionUnavailable()) {
    return NextResponse.json(
      { error: browserSessionUnavailableMessage() },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const limit = Number.isFinite(Number(body.limit))
    ? Math.min(25, Math.max(1, Math.trunc(Number(body.limit))))
    : 10;
  const repairs = await readThumbnailRepairs();
  const jobs = repairableThumbnailJobs(repairs, limit);

  if (jobs.length === 0) {
    return NextResponse.json({
      repaired: 0,
      failed: 0,
      message: "No broken thumbnails are waiting for repair."
    });
  }

  let repaired = 0;
  let failed = 0;
  const failures: Array<{ sourceId: string; error: string }> = [];
  const blockedPlatforms = new Map<string, string>();

  for (const job of jobs) {
    const platformBlock = blockedPlatforms.get(job.platform);
    if (platformBlock) {
      failures.push({ sourceId: job.sourceId, error: platformBlock });
      failed += 1;
      await markFailed(job, platformBlock);
      continue;
    }

    try {
      const [detail] = await collectBrowserSessionDetails([
        { url: job.sourceUrl, platform: job.platform }
      ]);
      if (!detail || !isUsableThumbnailUrl(detail.thumbnailUrl)) {
        throw new Error("The source page did not expose a usable thumbnail.");
      }

      await withDataStoreLock(async () => {
        const [sources, candidates, currentRepairs] = await Promise.all([
          readSourceItems(),
          readCollectionCandidates(),
          readThumbnailRepairs()
        ]);
        const now = new Date().toISOString();
        const nextSources = sources.map((source) =>
          source.id === job.sourceId || source.url === job.sourceUrl
            ? withRefreshedThumbnail(source, detail.thumbnailUrl!)
            : source
        );
        const nextCandidates = candidates.map((candidate) =>
          candidate.source.id === job.sourceId || candidate.source.url === job.sourceUrl
            ? {
                ...candidate,
                source: withRefreshedThumbnail(candidate.source, detail.thumbnailUrl!),
                updatedAt: now
              }
            : candidate
        );
        const nextRepairs = currentRepairs.map((repair) =>
          repair.sourceId === job.sourceId
            ? {
                ...repair,
                status: "repaired" as const,
                attempts: repair.attempts + 1,
                updatedAt: now,
                repairedAt: now,
                error: undefined
              }
            : repair
        );

        await Promise.all([
          writeSourceItems(nextSources),
          writeCollectionCandidates(nextCandidates),
          writeThumbnailRepairs(nextRepairs)
        ]);
      });
      repaired += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Thumbnail repair failed.";
      if (isFatalBrowserSessionError(message)) {
        blockedPlatforms.set(job.platform, message);
      }
      failures.push({ sourceId: job.sourceId, error: message });
      failed += 1;
      await markFailed(job, message);
    }
  }

  return NextResponse.json({
    repaired,
    failed,
    failures,
    message: `Repaired ${repaired} thumbnails; ${failed} failed. collectedAt was preserved.`
  });
}

async function markFailed(job: ThumbnailRepair, error: string): Promise<void> {
  await withDataStoreLock(async () => {
    const repairs = await readThumbnailRepairs();
    const now = new Date().toISOString();
    await writeThumbnailRepairs(
      repairs.map((repair) =>
        repair.sourceId === job.sourceId
          ? {
              ...repair,
              status: "failed",
              attempts: repair.attempts + 1,
              updatedAt: now,
              error
            }
          : repair
      )
    );
  });
}

function countStatuses(repairs: ThumbnailRepair[]) {
  return repairs.reduce(
    (counts, repair) => {
      counts[repair.status] += 1;
      return counts;
    },
    { pending: 0, processing: 0, repaired: 0, failed: 0 }
  );
}