import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { getSnapshot } from "@/lib/prices";
import { getForecast } from "@/lib/forecast/service";
import { getInsight } from "@/lib/ai/insights";
import { todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET ?commodity&district&market — AI summary line + possible price factors for the analysis page. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const commodity = params.get("commodity")?.trim();
  const district = params.get("district")?.trim() || profile.district;
  const market = params.get("market")?.trim() || null;
  if (!commodity) return NextResponse.json({ error: "commodity required" }, { status: 400 });

  // Facts are computed here on the server, never taken from the browser.
  const [snapshot, { result }] = await Promise.all([
    getSnapshot({ commodity, district, market }),
    getForecast({ commodity, district, market }),
  ]);
  const latest = snapshot.headline.latest;
  if (!latest) return NextResponse.json({ insight: null });

  const best = snapshot.markets.find((m) => m.market === snapshot.bestMarket);
  const forecast7 = result.sevenDay.ok
    ? {
        low: Math.min(...result.sevenDay.days.map((d) => d.low)),
        high: Math.max(...result.sevenDay.days.map((d) => d.high)),
      }
    : null;

  try {
    const insight = await getInsight(
      {
        commodity,
        place: market ?? `${district} and nearby districts`,
        district,
        market: market ?? "",
        date: todayIST(),
        latestPrice: latest.modal,
        latestDate: latest.date,
        changeVsYesterdayPct: snapshot.headline.changePct === null ? null : Number(snapshot.headline.changePct.toFixed(1)),
        change7dPct: result.trendPct === null ? null : Number(result.trendPct.toFixed(1)),
        trend: result.trend,
        bestNearby: best ? { mandi: best.market, price: best.latest.modal } : null,
        forecast7,
      },
      await getLocale(),
    );
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[insights] failed", err);
    return NextResponse.json({ insight: null });
  }
}
