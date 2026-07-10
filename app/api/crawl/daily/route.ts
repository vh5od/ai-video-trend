import { NextResponse } from "next/server";
import { collectBrowserSessionItems } from "@/lib/browser-session-crawler";
import { buildCollectionCandidates } from "@/lib/collection-candidates";
import { buildDailyCrawlTasks, isFatalBrowserSessionError } from "@/lib/daily-crawl";
import {
  readCollectionRuns,
  readCollectionCandidates,
  readSettings,
  readSourceItems,
  withDataStoreLock,
  writeCollectionRuns,
  writeCollectionCandidates
} from "@/lib/data-store";
import type { CollectionRun } from "@/lib/types";

export const runtime = "nodejs";

type DailyCrawlPlatform = "instagram" | "tiktok" | "all";

export async function POST(request: Request) {
  try {
    const now = new Date().toISOString();
    const body = await readRequestBody(request);
    const platform = normalizePlatform(body.platform);
    const settings = await readSettings();
    const tasks = buildDailyCrawlTasks(settings, { platform });

    if (tasks.length === 0) {
      return NextResponse.json({
        platform,
        tasks: 0,
        plannedTasks: [],
        itemsFound: 0,
        itemsStored: 0,
        runs: [],
        topics: [],
        message: `${platform} has no configured crawl tasks.`
      });
    }

    const [existingSources, existingCandidates] = await Promise.all([
      readSourceItems(),
      readCollectionCandidates()
    ]);
    const runs: CollectionRun[] = [];
    let workingCandidates = existingCandidates;
    let collectedCandidates: typeof existingCandidates = [];
    let itemsFound = 0;
    let itemsStored = 0;

    for (const task of tasks) {
      if (request.signal.aborted) {
        break;
      }
      try {
        const browserResult = await collectBrowserSessionItems({ task });
        if (request.signal.aborted) {
          break;
        }
        const result = buildCollectionCandidates({
          task: {
            ...task,
            items: browserResult.items
          },
          existingCandidates: workingCandidates,
          existingSources,
          keywords: settings.keywords,
          minLikes: settings.minLikes,
          now
        });

        workingCandidates = [...result.candidates, ...workingCandidates];
        collectedCandidates = [...result.candidates, ...collectedCandidates];
        itemsFound += browserResult.items.length;
        itemsStored += result.candidates.length;
        runs.push({
          id: `run_daily_${Date.now()}_${runs.length}`,
          platform: task.platform,
          provider: `daily_browser_session_${task.mode}`,
          status: "ready",
          startedAt: now,
          finishedAt: now,
          itemsFound: browserResult.items.length,
          itemsStored: result.candidates.length,
          message: `Daily crawl ${task.platform} ${task.mode} "${task.query}" found ${browserResult.items.length} and stored ${result.candidates.length} candidates for review. Skipped ${result.invalid} invalid records.`
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Daily crawl ${task.platform} ${task.mode} "${task.query}" failed.`;
        runs.push({
          id: `run_daily_${Date.now()}_${runs.length}`,
          platform: task.platform,
          provider: `daily_browser_session_${task.mode}`,
          status: "failed",
          startedAt: now,
          finishedAt: now,
          itemsFound: 0,
          itemsStored: 0,
          message
        });
        if (isFatalBrowserSessionError(message)) {
          break;
        }
      }
    }

    await withDataStoreLock(async () => {
      const [freshCandidates, existingRuns] = await Promise.all([
        readCollectionCandidates(),
        readCollectionRuns()
      ]);

      await Promise.all([
        writeCollectionCandidates(mergeCandidates(collectedCandidates, freshCandidates)),
        writeCollectionRuns([...runs, ...existingRuns])
      ]);
    });

    return NextResponse.json({
      platform,
      tasks: tasks.length,
      plannedTasks: tasks.map((task) => ({
        platform: task.platform,
        mode: task.mode,
        query: task.query
      })),
      itemsFound,
      itemsStored,
      runs,
      topics: []
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Daily crawl failed because of an unexpected server error."
      },
      { status: 500 }
    );
  }
}

async function readRequestBody(request: Request): Promise<{ platform?: unknown }> {
  try {
    return (await request.json()) as { platform?: unknown };
  } catch {
    return {};
  }
}

function normalizePlatform(value: unknown): DailyCrawlPlatform {
  return value === "instagram" || value === "tiktok" ? value : "all";
}

function mergeCandidates<T extends { id: string }>(incoming: T[], existing: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const candidate of [...incoming, ...existing]) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    merged.push(candidate);
  }

  return merged;
}
