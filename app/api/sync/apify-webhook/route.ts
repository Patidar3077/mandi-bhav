import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ingestRun } from "@/lib/apify";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function secretMatches(given: string | null) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(serverEnv.apifyWebhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Apify calls this when a run finishes (daily sync, Apify schedule, or live fetch). Saves the rows. */
export async function POST(request: NextRequest) {
  if (!secretMatches(request.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const payload = (await request.json().catch(() => null)) as {
    resource?: { id?: string };
    eventData?: { actorRunId?: string };
  } | null;
  const runId = payload?.resource?.id ?? payload?.eventData?.actorRunId;
  if (!runId) return NextResponse.json({ error: "no run id" }, { status: 400 });

  try {
    const result = await ingestRun(runId, { waitSecs: 10, adoptScheduledRuns: true });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[webhook] ingest failed", err);
    return NextResponse.json({ error: "unknown run" }, { status: 404 });
  }
}
