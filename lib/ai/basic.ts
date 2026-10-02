import "server-only";
import { getDailySeries, getSnapshot, listCommodities, listDistricts } from "@/lib/prices";
import { getForecast } from "@/lib/forecast/service";
import { commodityLabel, type Commodity } from "@/lib/commodities";
import { makeT, type Locale } from "@/lib/i18n/config";
import { formatDate, formatINR, formatPct, formatPerKg, formatSignedINR } from "@/lib/format";

/**
 * Basic Mandi helper: answers common price questions straight from our data, with no AI model.
 * Used when the AI service isn't available. Like the AI, it only ever states stored prices with their dates.
 */

type Intent = "latest" | "best" | "history" | "forecast";

const FORECAST = /next|expect|forecast|will\s+be|coming|future|अगले|अनुमान|आने\s*वाले|भविष्य|पुढच्या|पुढील|अंदाज|येत्या/i;
const BEST = /which\s+mandi|which\s+market|highest|best|most|top|compare|nearby|सबसे|ज़्यादा|ज्यादा|कौन\s*सी|कहाँ|सर्वात|जास्त|कोणत्या|कुठे/i;
const HISTORY = /last|past|days?|history|trend|week|पिछले|दिन|हफ्ते|हफ़्ते|मागील|दिवस|आठवड/i;

const normalise = (s: string) => s.toLowerCase().normalize("NFC");

function detectIntent(text: string): Intent {
  if (FORECAST.test(text)) return "forecast";
  if (BEST.test(text)) return "best";
  if (HISTORY.test(text)) return "history";
  return "latest";
}

/** Finds a crop named anywhere in the sentence, in English, Hindi or Marathi (incl. inflected forms like कांद्याचा). */
function detectCrop(text: string, list: Commodity[]): Commodity | null {
  const tokens = normalise(text).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const joined = ` ${tokens.join(" ")} `;
  let best: { c: Commodity; score: number; len: number } | null = null;
  for (const c of list) {
    const names = [c.data_name, c.name_en, c.name_hi ?? "", c.name_mr ?? "", ...c.aliases]
      .map(normalise)
      .map((n) => n.replace(/\(.*?\)/g, "").trim())
      .filter((n) => n.length >= 3);
    for (const n of names) {
      let score = 0;
      if (joined.includes(` ${n} `)) score = 3;
      else if (tokens.some((t) => t.startsWith(n))) score = 2;
      else if (n.length > 3 && tokens.some((t) => t.startsWith(n.slice(0, -1)))) score = 1;
      if (score && (!best || score > best.score || (score === best.score && n.length > best.len))) best = { c, score, len: n.length };
    }
  }
  return best?.c ?? null;
}

function detectDistrict(text: string, districts: string[]): string | null {
  const t = ` ${normalise(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  // Longest first so "Mumbai Suburban" wins over "Mumbai".
  return [...districts].sort((a, b) => b.length - a.length).find((d) => t.includes(` ${normalise(d)} `)) ?? null;
}

export async function basicAnswer(
  message: string,
  ctx: { district: string; locale: Locale; viewing?: { commodity: string; district: string; market: string | null } | null },
): Promise<string> {
  const t = makeT(ctx.locale);
  const [list, districts] = await Promise.all([listCommodities(), listDistricts()]);

  const crop = detectCrop(message, list) ?? (ctx.viewing ? list.find((c) => c.data_name === ctx.viewing!.commodity) ?? null : null);
  if (!crop) return t("bot.noCrop");

  const district = detectDistrict(message, districts) ?? (ctx.viewing?.commodity === crop.data_name ? ctx.viewing.district : ctx.district);
  const market = ctx.viewing && ctx.viewing.commodity === crop.data_name && ctx.viewing.district === district ? ctx.viewing.market : null;
  const name = commodityLabel(crop, ctx.locale);
  const place = market ?? t("bot.nearby", { district });
  const intent = detectIntent(message);

  if (intent === "forecast") {
    const { result } = await getForecast({ commodity: crop.data_name, district, market });
    if (!result.sevenDay.ok) {
      return `${t("bot.forecastNone", { crop: name, district, n: result.sevenDay.daysNeeded })}`;
    }
    const days = result.sevenDay.days;
    const low = Math.min(...days.map((d) => d.low));
    const high = Math.max(...days.map((d) => d.high));
    return [
      t("bot.forecast", {
        crop: name,
        place,
        from: formatDate(days[0].date, ctx.locale, false),
        to: formatDate(days[days.length - 1].date, ctx.locale, false),
        low: formatINR(low, ctx.locale),
        high: formatINR(high, ctx.locale),
        level: t(`analysis.${result.sevenDay.confidence}`),
      }),
      t("common.disclaimer"),
    ].join("\n\n");
  }

  if (intent === "history") {
    const n = Math.min(Math.max(Number(message.match(/\d+/)?.[0] ?? 7), 2), 30);
    const series = await getDailySeries({ commodity: crop.data_name, districts: [district], market, days: n });
    if (!series.length) return t("bot.noData", { crop: name, district });
    const lines = series.map((p) => `• ${formatDate(p.date, ctx.locale, false)}: ${formatINR(p.price, ctx.locale)}`);
    return `${t("bot.history", { crop: name, place, n })}\n${lines.join("\n")}`;
  }

  const snap = await getSnapshot({ commodity: crop.data_name, district, market });
  const latest = snap.headline.latest;
  if (!latest) return t("bot.noData", { crop: name, district });

  if (intent === "best") {
    const newest = snap.markets[0]?.latest.date;
    const top = snap.markets.filter((m) => m.latest.date === newest).slice(0, 5);
    if (!top.length) return t("bot.noData", { crop: name, district });
    const lines = top.map((m, i) => `${i + 1}. ${m.market} (${m.district}): ${formatINR(m.latest.modal, ctx.locale)}`);
    return `${t("bot.best", { crop: name, district, date: formatDate(newest!, ctx.locale) })}\n${lines.join("\n")}\n\n${t("analysis.transportNote")}`;
  }

  const parts = [
    t("bot.latest", {
      crop: name,
      place,
      price: formatINR(latest.modal, ctx.locale),
      perKg: formatPerKg(latest.modal, ctx.locale),
      date: formatDate(latest.date, ctx.locale),
    }),
  ];
  if (latest.min !== null && latest.max !== null) {
    parts.push(t("bot.range", { min: formatINR(latest.min, ctx.locale), max: formatINR(latest.max, ctx.locale) }));
  }
  if (snap.headline.change !== null) {
    parts.push(t("bot.change", { change: `${formatSignedINR(snap.headline.change, ctx.locale)} (${formatPct(snap.headline.changePct, ctx.locale)})` }));
  }
  return parts.join(" ");
}
