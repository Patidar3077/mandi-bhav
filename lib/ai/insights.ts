import "server-only";
import { claude, model, FALLBACK_BETA } from "./client";
import { adminClient } from "@/lib/supabase/admin";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/config";

export type Insight = { summary: string; factors: string[] };

export type InsightFacts = {
  commodity: string;
  place: string;
  district: string;
  market: string;
  date: string;
  latestPrice: number;
  latestDate: string;
  changeVsYesterdayPct: number | null;
  change7dPct: number | null;
  trend: string | null;
  bestNearby: { mandi: string; price: number } | null;
  forecast7: { low: number; high: number } | null;
};

/**
 * One plain-language summary line plus possible price factors (PRD 5.3), in the user's language.
 * The model only explains the numbers passed in; it never produces prices. Cached per day.
 */
export async function getInsight(facts: InsightFacts, locale: Locale): Promise<Insight> {
  const db = adminClient();
  const key = { commodity: facts.commodity, district: facts.district, market: facts.market, insight_date: facts.date, language: locale };
  const { data: cached } = await db
    .from("ai_insights")
    .select("summary, factors")
    .match(key)
    .maybeSingle();
  if (cached) return { summary: cached.summary as string, factors: (cached.factors as string[]) ?? [] };

  const response = await claude().beta.messages.create({
    model: model(),
    max_tokens: 1500,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            factors: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "factors"],
          additionalProperties: false,
        },
      },
    },
    system:
      "You write short, simple explanations of mandi price data for farmers in Maharashtra. Use only the numbers you are given; never invent or change a price. Words about what may move prices must be possibilities, not facts.",
    messages: [
      {
        role: "user",
        content: `Write in ${LOCALE_NAMES[locale]} (${locale}).
1. "summary": ONE short sentence (max 20 words) describing the current price movement of this crop at this place, e.g. "Onion prices in Pune are up 8% this week and still rising." Use only these facts.
2. "factors": 2 to 3 very short points (max 14 words each) about things that MAY move this crop's price in the coming weeks around this time of year (season, harvest arrivals, festivals, rain). Word each as a possibility ("may", "could").

Facts (prices are rupees per quintal):
${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !text || text.type !== "text") throw new Error("no insight produced");
  const parsed = JSON.parse(text.text) as Insight;
  const insight = { summary: String(parsed.summary ?? "").trim(), factors: (parsed.factors ?? []).map(String).slice(0, 3) };

  await db.from("ai_insights").upsert({ ...key, ...insight }, { onConflict: "commodity,district,market,insight_date,language", ignoreDuplicates: true });
  return insight;
}
