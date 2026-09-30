import { NextResponse } from "next/server";
import { SYNC_PARTS } from "@/lib/daily-sync";

export const dynamic = "force-dynamic";

/** The daily sync now runs in parts: /api/sync/daily/0 … /3 (see vercel.json crons). */
export function GET() {
  return NextResponse.json({ parts: Array.from({ length: SYNC_PARTS }, (_, i) => `/api/sync/daily/${i}`) });
}
