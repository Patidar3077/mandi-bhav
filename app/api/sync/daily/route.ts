import { NextResponse, type NextRequest } from "next/server";
import { startMandiRun } from "@/lib/apify";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Starts the daily Maharashtra sync. Called by Vercel Cron (sends `Authorization: Bearer $CRON_SECRET`).
 * Returns immediately; Apify calls /api/sync/apify-webhook when the run finishes and the rows are saved there.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await startMandiRun({ type: "daily" });
  return NextResponse.json(result);
}
