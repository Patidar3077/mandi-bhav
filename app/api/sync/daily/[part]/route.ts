import { NextResponse, type NextRequest } from "next/server";
import { runDailySyncPart, SYNC_PARTS } from "@/lib/daily-sync";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily sync for one group of crops (0–3). Called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/sync/daily/[part]">) {
  const secret = serverEnv.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const part = Number((await ctx.params).part);
  if (!Number.isInteger(part) || part < 0 || part >= SYNC_PARTS) {
    return NextResponse.json({ error: `part must be 0-${SYNC_PARTS - 1}` }, { status: 400 });
  }
  return NextResponse.json(await runDailySyncPart(part));
}
