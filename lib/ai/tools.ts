import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { adminClient } from "@/lib/supabase/admin";
import { getDailySeries, getSnapshot, listCommodities } from "@/lib/prices";
import { getForecast } from "@/lib/forecast/service";
import { ingestRun, startMandiRun } from "@/lib/apify";
import { liveAgmarknet } from "@/lib/agmarknet";
import { resolveCommodity, type Commodity } from "@/lib/commodities";

/**
 * Tools the chatbot uses to get data. It has no other source of prices (PRD 7.2).
 * Every price returned carries its date.
 */

const nullableString = (description: string) => ({ type: ["string", "null"], description });

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_latest_price",
    description:
      "Latest reported mandi price for a crop, with its date. Give a mandi (market) for one mandi, or a district for the average across that district and nearby districts. Prices are in rupees per quintal.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        commodity: { type: "string", description: "Crop name in any language or spelling, e.g. Onion, कांदा, pyaaz" },
        market: nullableString("Mandi name, e.g. Pune, Vashi. null if not specified"),
        district: nullableString("District name, e.g. Pune, Nashik. null to use the farmer's district"),
      },
      required: ["commodity", "market", "district"],
      additionalProperties: false,
    },
  },
  {
    name: "get_price_history",
    description: "Daily modal prices for the last N days (max 90) for a crop at a mandi or across a district, oldest first.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        commodity: { type: "string", description: "Crop name in any language" },
        market: nullableString("Mandi name, or null"),
        district: nullableString("District name, or null for the farmer's district"),
        days: { type: "integer", description: "Number of days of history, 1 to 90" },
      },
      required: ["commodity", "market", "district", "days"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_markets",
    description:
      "Latest price of a crop across all mandis in a district and its neighbouring districts, highest first. Use this for 'which mandi pays the most'.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        commodity: { type: "string", description: "Crop name in any language" },
        district: nullableString("District name, or null for the farmer's district"),
      },
      required: ["commodity", "district"],
      additionalProperties: false,
    },
  },
  {
    name: "get_forecast",
    description:
      "Statistical price forecast (next 7 days, and weeks 2-4 when there is enough history) from our model, or a 'not enough data' message. The only allowed source for future prices.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        commodity: { type: "string", description: "Crop name in any language" },
        market: nullableString("Mandi name, or null"),
        district: nullableString("District name, or null for the farmer's district"),
      },
      required: ["commodity", "market", "district"],
      additionalProperties: false,
    },
  },
  {
    name: "fetch_live_prices",
    description:
      "Fetch today's and yesterday's prices for a crop directly from the government mandi data (Agmarknet, with data.gov.in as a backup). Use it when the other tools return no recent data.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        commodity: { type: "string", description: "Crop name in any language" },
        district: nullableString("District name, or null for the farmer's district"),
      },
      required: ["commodity", "district"],
      additionalProperties: false,
    },
  },
];

type Ctx = { defaultDistrict: string };
type Args = { commodity?: string; market?: string | null; district?: string | null; days?: number };

let commodityCache: { at: number; list: Commodity[] } | null = null;
async function commodities() {
  if (!commodityCache || Date.now() - commodityCache.at > 10 * 60_000) {
    commodityCache = { at: Date.now(), list: await listCommodities() };
  }
  return commodityCache.list;
}

async function resolve(args: Args, ctx: Ctx) {
  const match = resolveCommodity(await commodities(), args.commodity ?? "");
  const commodity = match?.data_name ?? (args.commodity ?? "").trim();
  let district = args.district?.trim() || ctx.defaultDistrict;
  let market: string | null = args.market?.trim() || null;

  if (market) {
    // Match the mandi name loosely against known markets to find its real name and district.
    const { data } = await adminClient().from("markets").select("market, district").ilike("market", `%${market}%`).limit(5);
    const hit = data?.[0];
    if (hit) {
      market = hit.market as string;
      district = hit.district as string;
    }
  } else {
    const { data } = await adminClient().from("district_neighbours").select("district").ilike("district", district).limit(1);
    if (data?.[0]) district = data[0].district as string;
  }
  return { commodity, district, market, knownCrop: Boolean(match) };
}

export async function runTool(name: string, rawArgs: unknown, ctx: Ctx): Promise<unknown> {
  const args = (rawArgs ?? {}) as Args;
  const r = await resolve(args, ctx);
  const unit = "INR per quintal (divide by 100 for per kg)";

  switch (name) {
    case "get_latest_price": {
      const snap = await getSnapshot({ commodity: r.commodity, district: r.district, market: r.market });
      if (!snap.headline.latest) {
        return { found: false, commodity: r.commodity, district: r.district, market: r.market, note: "No stored price in the last 45 days." };
      }
      return {
        found: true,
        commodity: r.commodity,
        scope: r.market ? `mandi: ${r.market}` : `average across ${snap.districts.join(", ")}`,
        date: snap.headline.latest.date,
        modal_price: snap.headline.latest.modal,
        min_price: snap.headline.latest.min,
        max_price: snap.headline.latest.max,
        change_vs_previous_day: snap.headline.change,
        change_pct: snap.headline.changePct === null ? null : Number(snap.headline.changePct.toFixed(1)),
        is_today: snap.headline.latest.date === snap.today,
        today: snap.today,
        unit,
      };
    }
    case "get_price_history": {
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 90);
      const series = await getDailySeries({
        commodity: r.commodity,
        districts: [r.district],
        market: r.market,
        days,
      });
      return {
        commodity: r.commodity,
        scope: r.market ? `mandi: ${r.market}` : `district average: ${r.district}`,
        days_requested: days,
        prices: series.map((p) => ({ date: p.date, modal_price: p.price })),
        note: series.length ? undefined : "No stored history for this period.",
        unit,
      };
    }
    case "compare_markets": {
      const snap = await getSnapshot({ commodity: r.commodity, district: r.district });
      return {
        commodity: r.commodity,
        districts: snap.districts,
        today: snap.today,
        mandis: snap.markets.slice(0, 20).map((m) => ({
          mandi: m.market,
          district: m.district,
          date: m.latest.date,
          modal_price: m.latest.modal,
          min_price: m.latest.min,
          max_price: m.latest.max,
          change_vs_previous_day: m.change,
        })),
        best_price_mandi: snap.bestMarket,
        unit,
      };
    }
    case "get_forecast": {
      const { result, usedNearbyAverage } = await getForecast({ commodity: r.commodity, district: r.district, market: r.market });
      return {
        commodity: r.commodity,
        scope: usedNearbyAverage ? `average of mandis in and around ${r.district}` : `mandi: ${r.market}`,
        last_price: result.lastPrice,
        last_date: result.lastDate,
        trend: result.trend,
        trend_pct_7d: result.trendPct === null ? null : Number(result.trendPct.toFixed(1)),
        next_7_days: result.sevenDay.ok
          ? { confidence: result.sevenDay.confidence, days: result.sevenDay.days }
          : { available: false, days_of_history_still_needed: result.sevenDay.daysNeeded },
        weeks_2_to_4: result.weeks.ok
          ? { confidence: result.weeks.confidence, weeks: result.weeks.weeks }
          : { available: false, days_of_history_still_needed: result.weeks.daysNeeded },
        method: result.method,
        must_include_disclaimer: "This is an estimate based on past market prices, not a guaranteed future price. Check with your mandi before selling.",
        unit,
      };
    }
    case "fetch_live_prices": {
      const liveMandis = async (rowsSaved: number) => {
        const snap = await getSnapshot({ commodity: r.commodity, district: r.district });
        return {
          fetched: true,
          rows_saved: rowsSaved,
          mandis: snap.markets.slice(0, 15).map((m) => ({ mandi: m.market, date: m.latest.date, modal_price: m.latest.modal })),
          unit,
        };
      };
      // Agmarknet first (free, seconds); Apify + data.gov.in only if that fails.
      const agm = await liveAgmarknet(r.commodity).catch(() => null);
      if (agm && ("skipped" in agm || (agm.requests > 0 && !agm.error))) {
        return liveMandis("skipped" in agm ? 0 : agm.rowsSaved);
      }
      const start = await startMandiRun({ type: "live", district: r.district, commodity: r.commodity });
      if (!("apifyRunId" in start)) return { fetched: false, reason: start.message };
      const ingest = await ingestRun(start.apifyRunId, { waitSecs: 40 });
      if (ingest.status === "running") {
        return { fetched: false, reason: "The mandi data is still loading. Ask the farmer to try again in a minute." };
      }
      if (ingest.status === "failed") return { fetched: false, reason: ingest.error ?? "fetch failed" };
      return liveMandis(ingest.rowsSaved);
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
