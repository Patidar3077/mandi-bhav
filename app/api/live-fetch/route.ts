import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { ingestRun, startMandiRun } from "@/lib/apify";
import { todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { commodity, district } starts (or reuses) a live Apify fetch and waits briefly.
 * GET ?runId= checks progress. The client gives up after ~90s and shows the last stored price.
 */
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { commodity?: string; district?: string };
  const commodity = body.commodity?.trim();
  const district = body.district?.trim();
  if (!commodity || !district) return NextResponse.json({ error: "commodity and district required" }, { status: 400 });

  // Only allowed right after a counted search for the same crop + district today.
  const { data: searched } = await adminClient()
    .from("searches")
    .select("id")
    .eq("user_id", profile.id)
    .eq("commodity", commodity)
    .eq("district", district)
    .eq("search_date", todayIST())
    .limit(1);
  if (!searched?.length) return NextResponse.json({ error: "search first" }, { status: 400 });

  const start = await startMandiRun({ type: "live", commodity, district });
  if (!("apifyRunId" in start)) return NextResponse.json({ status: start.status, message: start.message });

  const result = await ingestRun(start.apifyRunId, { waitSecs: 25 });
  return NextResponse.json({ ...result, runId: start.apifyRunId });
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  try {
    const result = await ingestRun(runId, { waitSecs: 20 });
    return NextResponse.json({ ...result, runId });
  } catch {
    return NextResponse.json({ status: "failed", rowsSaved: 0, runId }, { status: 404 });
  }
}
