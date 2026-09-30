import { NextResponse, type NextRequest } from "next/server";
import { syncAgmarknet } from "@/lib/agmarknet";
import { serverEnv } from "@/lib/env";
import { addDays, daysBetween } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_DAYS_PER_CALL = 7;

/**
 * Backfill history from Agmarknet: GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (at most 7 days per call).
 * Protected by `Authorization: Bearer $CRON_SECRET`. Call repeatedly to cover longer periods.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? from;
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(from) || !isDate(to) || daysBetween(from, to) < 0 || daysBetween(from, to) >= MAX_DAYS_PER_CALL) {
    return NextResponse.json({ error: `from/to must be dates at most ${MAX_DAYS_PER_CALL} days apart` }, { status: 400 });
  }
  const dates = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  const result = await syncAgmarknet({ dates, concurrency: 3 });
  return NextResponse.json({ dates, ...result });
}
