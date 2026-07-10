import { NextResponse } from "next/server";
import {
  readSettings,
  readSourceItems,
  readTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const [storedTopics, sources, settings] = await Promise.all([
    readTrendTopics(),
    readSourceItems(),
    readSettings()
  ]);
  const topics =
    storedTopics.length > 0
      ? storedTopics
      : generateTrendTopics(sources, settings);

  const trend = topics.find((topic) => topic.id === id);
  if (!trend) {
    return NextResponse.json({ error: "Trend not found." }, { status: 404 });
  }

  const evidence = sources.filter((source) => trend.sourceIds.includes(source.id));
  return NextResponse.json({ trend, evidence });
}
