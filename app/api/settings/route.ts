import { NextResponse } from "next/server";
import { readSettings, withDataStoreLock, writeSettings } from "@/lib/data-store";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const body = await request.json();
  const settings = await withDataStoreLock(async () => {
    const current = await readSettings();
    const settings: Settings = {
      instagramHashtags: normalizeList(body.instagramHashtags),
      instagramCreators: normalizeList(body.instagramCreators),
      tiktokHashtags: normalizeList(body.tiktokHashtags),
      tiktokCreators: normalizeList(body.tiktokCreators),
      keywords: normalizeList(body.keywords),
      dailyCrawlLimit: normalizePositiveNumber(body.dailyCrawlLimit, current.dailyCrawlLimit),
      hashtagCrawlLimit: normalizePositiveNumber(
        body.hashtagCrawlLimit,
        current.hashtagCrawlLimit ?? current.dailyCrawlLimit
      ),
      creatorCrawlLimit: normalizePositiveNumber(
        body.creatorCrawlLimit,
        current.creatorCrawlLimit ?? current.dailyCrawlLimit
      ),
      commentsPerVideo: normalizePositiveNumber(body.commentsPerVideo, current.commentsPerVideo),
      minLikes: normalizeNonNegativeNumber(body.minLikes, current.minLikes),
      refreshSchedule: String(body.refreshSchedule || current.refreshSchedule || "daily")
    };

    await writeSettings(settings);
    return settings;
  });
  return NextResponse.json(settings);
}

function normalizeList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.floor(number);
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.floor(number);
}
