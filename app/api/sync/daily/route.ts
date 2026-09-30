import { NextResponse, type NextRequest } from "next/server";
import { startMandiRun } from "@/lib/apify";
import { syncAgmarknet } from "@/lib/agmarknet";
import { serverEnv } from "@/lib/env";
import { addDays, todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily sync, called by Vercel Cron (sends `Authorization: Bearer $CRON_SECRET`).
 * 1. Agmarknet (free): today's and yesterday's prices for every crop we know.
 * 2. Only if Agmarknet fails: the paid Apify / data.gov.in run (rows arrive later via the webhook).
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const today = todayIST();
  const agmarknet = await syncAgmarknet({ dates: [today, addDays(today, -1)] });
  if (!agmarknet.error && agmarknet.rowsSaved > 0) return NextResponse.json({ agmarknet });

  const apify = await startMandiRun({ type: "daily" });
  return NextResponse.json({ agmarknet, apify });
}
