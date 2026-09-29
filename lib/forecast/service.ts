import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { getDailySeries, getNeighbours } from "@/lib/prices";
import { todayIST } from "@/lib/format";
import { forecast, type ForecastResult, type Point } from "./model";

export type ForecastBundle = {
  result: ForecastResult;
  series: Point[];
  usedNearbyAverage: boolean;
};

/**
 * Forecast for one mandi, or for the average across nearby mandis when that mandi's
 * history is too thin (PRD 6.1). Saves every produced forecast to `predictions`.
 */
export async function getForecast(opts: { commodity: string; district: string; market?: string | null }): Promise<ForecastBundle> {
  const districts = await getNeighbours(opts.district);
  let usedNearbyAverage = !opts.market;
  let series = await getDailySeries({ commodity: opts.commodity, districts, market: opts.market, days: 120 });
  let result = forecast(series);

  if (opts.market && !result.sevenDay.ok) {
    const nearby = await getDailySeries({ commodity: opts.commodity, districts, days: 120 });
    const nearbyResult = forecast(nearby);
    if (nearbyResult.sevenDay.ok) {
      series = nearby;
      result = nearbyResult;
      usedNearbyAverage = true;
    }
  }

  if (result.sevenDay.ok) {
    await savePredictions(opts.commodity, usedNearbyAverage ? "" : opts.market ?? "", opts.district, result).catch((e) =>
      console.error("[forecast] save failed", e),
    );
  }
  return { result, series, usedNearbyAverage };
}

async function savePredictions(commodity: string, market: string, district: string, r: ForecastResult) {
  const madeOn = todayIST();
  const rows = [];
  if (r.sevenDay.ok) {
    r.sevenDay.days.forEach((d, i) =>
      rows.push({
        commodity,
        market,
        district,
        made_on: madeOn,
        horizon: `d${i + 1}`,
        target_date: d.date,
        predicted_low: d.low,
        predicted_mid: d.mid,
        predicted_high: d.high,
        confidence: r.sevenDay.ok ? r.sevenDay.confidence : "low",
        method_version: r.method,
      }),
    );
  }
  if (r.weeks.ok) {
    for (const w of r.weeks.weeks) {
      rows.push({
        commodity,
        market,
        district,
        made_on: madeOn,
        horizon: `w${w.week}`,
        target_date: w.start,
        predicted_low: w.low,
        predicted_mid: w.mid,
        predicted_high: w.high,
        confidence: r.weeks.confidence,
        method_version: r.method,
      });
    }
  }
  if (rows.length) {
    await adminClient()
      .from("predictions")
      .upsert(rows, { onConflict: "commodity,market,district,made_on,horizon,method_version", ignoreDuplicates: true });
  }
}
