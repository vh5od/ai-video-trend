import { NextResponse } from "next/server";
import { getCrawlerProviderStatuses } from "@/lib/crawler";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    providers: getCrawlerProviderStatuses()
  });
}
