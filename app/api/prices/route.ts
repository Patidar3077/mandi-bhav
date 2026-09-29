import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { consumeSearch } from "@/lib/limits";
import { getSnapshot } from "@/lib/prices";

export const dynamic = "force-dynamic";

/** GET /api/prices?commodity=Onion&district=Pune&market=Pune — one "Check Market Price" search. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const commodity = params.get("commodity")?.trim();
  const district = params.get("district")?.trim() || profile.district;
  const market = params.get("market")?.trim() || null;
  if (!commodity) return NextResponse.json({ error: "commodity required" }, { status: 400 });

  const limit = await consumeSearch(profile, commodity, district, market);
  if (!limit.ok) return NextResponse.json({ error: "limit", ...limit }, { status: 429 });

  const snapshot = await getSnapshot({ commodity, district, market });
  return NextResponse.json({ snapshot });
}
