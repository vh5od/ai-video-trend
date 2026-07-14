import { NextResponse } from "next/server";
import { collectBrowserSessionItems } from "@/lib/browser-session-crawler";
import { buildCollectionCandidates } from "@/lib/collection-candidates";
import {
  applyCrawlerItemUpdates,
  validateCrawlerTask
} from "@/lib/crawler";
import {
  browserSessionUnavailableMessage,
  isCloudBrowserSessionUnavailable
} from "@/lib/deployment";
import {
  readCollectionRuns,
  readCollectionCandidates,
  readSettings,
  readSourceItems,
  withDataStoreLock,
  writeCollectionRuns,
  writeCollectionCandidates,
  writeSourceItems
} from "@/lib/data-store";
import type { CollectionRun } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const validation = validateCrawlerTask(body);

  if (!validation.valid || !validation.task) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const task = validation.task;
  if (task.provider !== "manual_import" && task.provider !== "browser_session") {
    const now = new Date().toISOString();
    const run = buildRun({
      id: `run_crawler_${Date.now()}`,
      task,
      now,
      itemsFound: 0,
      itemsStored: 0,
      status: "failed",
      message: `${task.provider} is not configured for ${task.platform}. Use manual_import or configure a provider adapter.`
    });
    await withDataStoreLock(async () => {
      const runs = await readCollectionRuns();
      await writeCollectionRuns([run, ...runs]);
    });
    return NextResponse.json({ run, candidates: [] }, { status: 501 });
  }

  const now = new Date().toISOString();
  if (task.provider === "browser_session") {
    if (isCloudBrowserSessionUnavailable()) {
      const run = buildRun({
        id: `run_crawler_${Date.now()}`,
        task,
        now,
        itemsFound: 0,
        itemsStored: 0,
        status: "failed",
        message: browserSessionUnavailableMessage()
      });
      await withDataStoreLock(async () => {
        const runs = await readCollectionRuns();
        await writeCollectionRuns([run, ...runs]);
      });
      return NextResponse.json({ run, candidates: [] }, { status: 503 });
    }

    try {
      const browserResult = await collectBrowserSessionItems({ task });
      task.items = browserResult.items;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Browser session collection failed.";
      const run = buildRun({
        id: `run_crawler_${Date.now()}`,
        task,
        now,
        itemsFound: 0,
        itemsStored: 0,
          status: "failed",
          message
        });
      await withDataStoreLock(async () => {
        const runs = await readCollectionRuns();
        await writeCollectionRuns([run, ...runs]);
      });
      return NextResponse.json({ run, candidates: [] }, { status: 503 });
    }
  }

  const { result, run } = await withDataStoreLock(async () => {
    const [sources, candidates, settings, runs] = await Promise.all([
      readSourceItems(),
      readCollectionCandidates(),
      readSettings(),
      readCollectionRuns()
    ]);
    const result = buildCollectionCandidates({
      task,
      existingCandidates: candidates,
      existingSources: sources,
      keywords: settings.keywords,
      minLikes: settings.minLikes,
      now
    });
    const nextCandidates = [...result.candidates, ...candidates];
    const run = buildRun({
      id: `run_crawler_${Date.now()}`,
      task,
      now,
      itemsFound: task.items?.length ?? 0,
      itemsStored: result.candidates.length,
      status: "ready",
      message: buildImportMessage(task, result)
    });

    await Promise.all([
      result.updatedSources.length > 0
        ? writeSourceItems(applyCrawlerItemUpdates(sources, result.updatedSources))
        : Promise.resolve(),
      writeCollectionCandidates(nextCandidates),
      writeCollectionRuns([run, ...runs])
    ]);
    return { result, run };
  });

  return NextResponse.json({ ...result, run });
}

function buildImportMessage(
  task: NonNullable<ReturnType<typeof validateCrawlerTask>["task"]>,
  result: ReturnType<typeof buildCollectionCandidates>
): string {
  const action = task.provider === "browser_session" ? "Collected" : "Imported";
  return `${action} ${result.candidates.length} ${task.platform} candidates for ${task.mode} "${task.query}". Review and approve them in Collection Inbox before they enter the dashboard. Skipped ${result.invalid} invalid records.`;
}

function buildRun({
  id,
  task,
  now,
  itemsFound,
  itemsStored,
  status,
  message
}: {
  id: string;
  task: NonNullable<ReturnType<typeof validateCrawlerTask>["task"]>;
  now: string;
  itemsFound: number;
  itemsStored: number;
  status: CollectionRun["status"];
  message: string;
}): CollectionRun {
  return {
    id,
    platform: task.platform,
    provider: `crawler_${task.provider}_${task.mode}`,
    status,
    startedAt: now,
    finishedAt: now,
    itemsFound,
    itemsStored,
    message
  };
}
