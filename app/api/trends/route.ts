import { NextResponse } from "next/server";
import {
  readSettings,
  readSourceItems,
  readTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";

export const runtime = "nodejs";

export async function GET() {
  const [storedTopics, sources, settings] = await Promise.all([
    readTrendTopics(),
    readSourceItems(),
    readSettings()
  ]);
  const topics =
    storedTopics.length > 0
      ? storedTopics
      : generateTrendTopics(sources, settings);

  return NextResponse.json({ trends: topics });
}
