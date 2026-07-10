import { NextResponse } from "next/server";
import {
  readCollectionRuns,
  readSettings,
  readSourceItems,
  withDataStoreLock,
  writeCollectionRuns,
  writeSourceItems,
  writeTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";
import {
  normalizeManualSeed,
  normalizeManualXSeed,
  validateManualSeed,
  validateManualXSeed
} from "@/lib/validation";
import type { CollectionRun } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const sources = await readSourceItems();
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const body = await request.json();
  const platform = body.platform === "x" ? "x" : "instagram";
  const validation =
    platform === "x" ? validateManualXSeed(body) : validateManualSeed(body);

  if (!validation.valid) {
    return NextResponse.json(
      { errors: validation.errors },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const item =
    platform === "x" ? normalizeManualXSeed(body, now) : normalizeManualSeed(body, now);
  const run: CollectionRun = {
    id: `run_${Date.now()}`,
    platform,
    provider: platform === "x" ? "manual_x_seed" : "manual_seed",
    status: "ready",
    startedAt: now,
    finishedAt: now,
    itemsFound: 1,
    itemsStored: 1,
    message:
      platform === "x"
        ? "Manual X seed stored and trend topics regenerated."
        : "Manual Instagram seed stored and trend topics regenerated."
  };
  const topics = await withDataStoreLock(async () => {
    const [sources, settings, runs] = await Promise.all([
      readSourceItems(),
      readSettings(),
      readCollectionRuns()
    ]);
    const nextSources = [item, ...sources];
    const topics = generateTrendTopics(nextSources, settings, now);

    await Promise.all([
      writeSourceItems(nextSources),
      writeTrendTopics(topics),
      writeCollectionRuns([run, ...runs])
    ]);
    return topics;
  });

  return NextResponse.json({ source: item, topics });
}
