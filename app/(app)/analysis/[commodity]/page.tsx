import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ChangeBadge } from "@/components/ChangeBadge";
import { ChatViewing } from "@/components/chat/ChatProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TrendChart } from "@/components/analysis/TrendChart";
import { InsightFactors, InsightLine } from "@/components/analysis/Insight";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { consumeSearch } from "@/lib/limits";
import { getSnapshot } from "@/lib/prices";
import { getForecast } from "@/lib/forecast/service";
import { adminClient } from "@/lib/supabase/admin";
import { commodityLabel, fallbackCommodity, type Commodity } from "@/lib/commodities";
import { addDays, formatDate, formatINR, formatPct, formatPerKg, formatSignedINR } from "@/lib/format";
import type { Point } from "@/lib/forecast/model";

type Params = { commodity: string };

async function loadCommodity(dataName: string): Promise<Commodity> {
  const { data } = await adminClient()
    .from("commodities")
    .select("data_name, name_en, name_hi, name_mr, aliases, is_quick_pick")
    .eq("data_name", dataName)
    .maybeSingle();
  return (data as Commodity | null) ?? fallbackCommodity(dataName);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { commodity } = await params;
  const { t, locale } = await getT();
  const c = await loadCommodity(decodeURIComponent(commodity));
  return { title: `${commodityLabel(c, locale)} · ${t("nav.trends")}` };
}

/** Price on (or up to 3 days before) a date. */
function priceNear(series: Point[], date: string) {
  for (let back = 0; back <= 3; back++) {
    const hit = series.find((p) => p.date === addDays(date, -back));
    if (hit) return hit.price;
  }
  return null;
}

export default async function AnalysisPage({ params, searchParams }: PageProps<"/analysis/[commodity]">) {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const commodity = decodeURIComponent((await params).commodity);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || "";
  const district = one(sp.district) || profile.district;
  const market = one(sp.market) || null;
  const crop = await loadCommodity(commodity);
  const cropName = commodityLabel(crop, locale);
  const place = market ?? `${district} · ${t("market.allNearby")}`;
  const backHref = `/market?${new URLSearchParams({ crop: commodity, district, ...(market ? { market } : {}) })}`;

  const limit = await consumeSearch(profile, commodity, district, market);
  if (!limit.ok) {
    return <div className="card mx-auto max-w-xl bg-down-bg p-5 text-[15px] text-down">{t("limits.fairUse")}</div>;
  }

  const [snapshot, { result, series, usedNearbyAverage }] = await Promise.all([
    getSnapshot({ commodity, district, market }),
    getForecast({ commodity, district, market }),
  ]);
  const latest = snapshot.headline.latest;
  const insightUrl = `/api/insights?${new URLSearchParams({ commodity, district, ...(market ? { market } : {}) })}`;

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={backHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-cream px-3 text-xs font-semibold text-brown hover:bg-sand">
          <Icon name="arrow_back" className="text-[18px]" /> {t("analysis.back")}
        </Link>
        <h1 className="text-lg font-semibold text-leaf-deep">{t("market.showingFor", { crop: cropName, place })}</h1>
      </div>
      {latest && (
        <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-semibold text-brown shadow-card">
          <span className="pulse-dot h-2 w-2 rounded-full bg-leaf" /> {t("common.pricesFor", { date: formatDate(latest.date, locale) })}
        </span>
      )}
    </div>
  );

  if (!latest) {
    return (
      <>
        {header}
        <section className="card p-5">
          <p className="text-[17px] font-semibold">{t("market.noData", { crop: cropName, district })}</p>
          <p className="mt-1 text-[15px] text-muted">{t("market.noDataHint")}</p>
        </section>
      </>
    );
  }

  // Historical comparison (from the same series the forecast uses).
  const last = series.at(-1);
  const p7 = last ? priceNear(series, addDays(last.date, -7)) : null;
  const p30 = last ? priceNear(series, addDays(last.date, -30)) : null;
  const last30 = last ? series.filter((p) => p.date > addDays(last.date, -30)) : [];
  const avg30 = last30.length >= 5 ? Math.round(last30.reduce((a, p) => a + p.price, 0) / last30.length) : null;
  const tile = (label: string, now: number | null, then: number | null) => {
    const diff = now !== null && then !== null ? now - then : null;
    return (
      <div className="flex flex-col justify-center rounded-xl bg-cream p-4">
        <span className="text-[13px] text-brown">{label}</span>
        {diff === null ? (
          <span className="text-[15px] text-muted">{t("analysis.noValue")}</span>
        ) : (
          <span className={`flex items-baseline gap-1 text-lg font-semibold tabular ${diff >= 0 ? "text-leaf" : "text-down"}`}>
            {formatPct((diff / then!) * 100, locale)}
            <span className="text-xs font-semibold text-muted">({formatSignedINR(diff, locale)})</span>
          </span>
        )}
      </div>
    );
  };

  const trendKey = result.trend ? `analysis.${result.trend}` : "analysis.trendUnknown";
  const trendIcon = result.trend === "rising" ? "trending_up" : result.trend === "falling" ? "trending_down" : "trending_flat";
  const forecastDays = result.sevenDay.ok ? result.sevenDay.days : [];

  // Selling guidance
  const reference = market ? latest.modal : snapshot.avgNearby?.value ?? latest.modal;
  const newest = snapshot.markets[0]?.latest.date;
  const better = snapshot.markets
    .filter((m) => m.latest.date === newest && m.market !== market && m.latest.modal > reference * 1.01)
    .slice(0, 3);
  const peak = forecastDays.reduce<(typeof forecastDays)[number] | null>((best, d) => (!best || d.mid > best.mid ? d : best), null);
  const sellWindow = peak && result.lastPrice && peak.mid > result.lastPrice * 1.03 ? peak : null;

  const maxMarket = Math.max(...snapshot.markets.filter((m) => m.latest.date === newest).map((m) => m.latest.modal), 1);

  const disclaimer = (
    <p className="flex items-start gap-2 rounded-xl bg-cream p-3 text-[13px] leading-[18px] text-brown">
      <Icon name="info" className="shrink-0 text-[18px]" /> {t("common.disclaimer")}
    </p>
  );

  return (
    <>
      <ChatViewing commodity={commodity} district={district} market={market} />
      {header}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          {/* 1. Summary */}
          <section className="card relative overflow-hidden p-4 sm:p-6">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-leaf-soft/30 blur-2xl" />
            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {latest.varieties[0] && (
                      <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-brown">{latest.varieties[0]}</span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        result.trend === "rising" ? "bg-leaf-soft text-leaf-deep" : result.trend === "falling" ? "bg-down-bg text-down" : "bg-soil text-muted"
                      }`}
                    >
                      <Icon name={trendIcon} className="text-[14px]" /> {t(trendKey)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                    <span className="text-[32px] font-extrabold leading-[38px] tracking-tight text-leaf-deep tabular">{formatINR(latest.modal, locale)}</span>
                    <span className="text-[17px] text-brown">
                      {t("common.perQuintal")} ({formatPerKg(latest.modal, locale)} {t("common.perKg")})
                    </span>
                  </div>
                </div>
                {snapshot.headline.change !== null && (
                  <ChangeBadge change={snapshot.headline.change} pct={snapshot.headline.changePct} />
                )}
              </div>
              <div className="border-t border-line pt-3">
                <InsightLine url={insightUrl} />
              </div>
            </div>
          </section>

          {/* 2 + 3. Trend chart and historical comparison */}
          <section className="card flex flex-col gap-4 p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-leaf-deep">{t("analysis.chartTitle")}</h2>
              <p className="text-[13px] text-muted">{t("analysis.chartSub")}</p>
            </div>
            <TrendChart series={series} forecast={forecastDays} />
            {usedNearbyAverage && market && <p className="text-[13px] text-muted">{t("analysis.nearbyAvgNote")}</p>}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-brown">{t("analysis.historyTitle")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {tile(t("analysis.vs7"), last?.price ?? null, p7)}
                {tile(t("analysis.vs30"), last?.price ?? null, p30)}
                <div className="flex flex-col justify-center rounded-xl bg-cream p-4">
                  <span className="text-[13px] text-brown">{t("analysis.avg30")}</span>
                  {avg30 === null ? (
                    <span className="text-[15px] text-muted">{t("analysis.noValue")}</span>
                  ) : (
                    <span className="text-lg font-semibold tabular">
                      {formatINR(avg30, locale)} <span className="text-xs text-muted">/ {t("common.qtl")}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 4. Market comparison */}
            <section className="card p-4 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-lg font-semibold text-leaf-deep">
                <Icon name="storefront" /> {t("analysis.marketCompare")}
              </h2>
              <p className="mb-3 text-[13px] text-brown">
                {t("analysis.marketCompareSub")}
                {newest ? ` · ${formatDate(newest, locale)}` : ""}
              </p>
              <ul className="flex flex-col gap-2">
                {snapshot.markets
                  .filter((m) => m.latest.date === newest)
                  .slice(0, 8)
                  .map((m) => {
                    const best = m.market === snapshot.bestMarket;
                    const current = m.market === market;
                    return (
                      <li key={m.market} className={`rounded-xl p-2.5 ${best ? "bg-cream" : ""}`}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className={current ? "text-leaf-deep" : ""}>{m.market}</span>
                            {best && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-peach px-1.5 text-[11px] font-bold text-brown">
                                <Icon name="star" filled className="text-[12px]" /> {t("market.bestPrice")}
                              </span>
                            )}
                          </span>
                          <span className="text-base font-bold tabular">{formatINR(m.latest.modal, locale)}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand">
                          <div
                            className={`h-full rounded-full ${best ? "bg-leaf-deep" : current ? "bg-fresh" : "bg-muted/60"}`}
                            style={{ width: `${Math.max(8, (m.latest.modal / maxMarket) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>

            {/* 5. Forecast */}
            <section className="card flex flex-col gap-3 p-4 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-lg font-semibold text-leaf-deep">
                <Icon name="auto_graph" /> {t("analysis.forecastTitle")}
              </h2>
              {result.sevenDay.ok ? (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-cream p-3">
                    <div>
                      <span className="block font-semibold">{t("analysis.next7")}</span>
                      <span className="text-[13px] text-muted">
                        {formatDate(forecastDays[0].date, locale, false)} – {formatDate(forecastDays[6].date, locale, false)}
                      </span>
                      <span className="mt-1 block w-fit rounded-full bg-up-bg px-2 py-0.5 text-[11px] font-semibold text-leaf">
                        {t("analysis.confidence", { level: t(`analysis.${result.sevenDay.confidence}`) })}
                      </span>
                    </div>
                    <span className="text-right text-lg font-bold text-leaf-deep tabular">
                      {formatINR(Math.min(...forecastDays.map((d) => d.low)), locale)} – {formatINR(Math.max(...forecastDays.map((d) => d.high)), locale)}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 gap-1 text-[13px]">
                    {forecastDays.map((d) => (
                      <li key={d.date} className="flex justify-between gap-2 border-b border-line/60 py-1 tabular">
                        <span className="text-muted">{formatDate(d.date, locale, false)}</span>
                        <span>
                          {formatINR(d.low, locale)} – {formatINR(d.high, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {result.weeks.ok ? (
                    <ul className="flex flex-col gap-1">
                      {result.weeks.weeks.map((w) => (
                        <li key={w.week} className="flex items-center justify-between gap-2 rounded-xl p-2">
                          <div>
                            <span className="block font-semibold">{t("analysis.week", { n: w.week })}</span>
                            <span className="text-[13px] text-muted">
                              {formatDate(w.start, locale, false)} – {formatDate(w.end, locale, false)}
                            </span>
                          </div>
                          <span className="font-bold tabular">
                            {formatINR(w.low, locale)} – {formatINR(w.high, locale)}
                          </span>
                        </li>
                      ))}
                      <li className="text-[11px] text-brown">
                        {t("analysis.confidence", { level: t(`analysis.${result.weeks.confidence}`) })} · {t("analysis.bandNote")}
                      </li>
                    </ul>
                  ) : (
                    <p className="text-[13px] text-muted">{t("analysis.notEnough4w", { n: result.weeks.daysNeeded })}</p>
                  )}
                </>
              ) : (
                <p className="rounded-xl bg-cream p-3 text-[15px] text-brown">
                  {t("analysis.notEnough", { n: result.sevenDay.daysNeeded })}
                </p>
              )}
              {disclaimer}
            </section>
          </div>

          {/* 6. Selling guidance */}
          <section className="card p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-leaf-deep">
              <Icon name="lightbulb" className="text-brown" /> {t("analysis.guidanceTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex items-start gap-3 rounded-xl bg-cream p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
                  <Icon name="local_shipping" className="text-[18px]" />
                </span>
                <div>
                  <p className="font-semibold">{t("analysis.betterMandis")}</p>
                  {better.length ? (
                    <ul className="mt-1 flex flex-col gap-1 text-[13px] leading-[18px] text-muted">
                      {better.map((m) => (
                        <li key={m.market}>
                          {t("analysis.betterMandiItem", {
                            mandi: m.market,
                            diff: formatINR(m.latest.modal - reference, locale),
                            date: formatDate(m.latest.date, locale, false),
                          })}
                        </li>
                      ))}
                      <li className="text-brown">{t("analysis.transportNote")}</li>
                    </ul>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">{t("analysis.noBetterMandi")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-cream p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
                  <Icon name="calendar_today" className="text-[18px]" />
                </span>
                <div>
                  <p className="font-semibold">{t("analysis.sellingWindow")}</p>
                  <p className="mt-1 text-[13px] leading-[18px] text-muted">
                    {!result.sevenDay.ok
                      ? t("analysis.noForecastWindow")
                      : sellWindow
                        ? t("analysis.windowItem", { date: formatDate(sellWindow.date, locale, false), price: formatINR(sellWindow.mid, locale) })
                        : t("analysis.noWindow")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-cream p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-peach text-brown">
                  <Icon name="radar" className="text-[18px]" />
                </span>
                <div>
                  <p className="mb-1 font-semibold">{t("analysis.factorsTitle")}</p>
                  <InsightFactors url={insightUrl} />
                </div>
              </div>
            </div>
          </section>

          {/* 7. Disclaimer */}
          {disclaimer}
        </div>

        <aside className="sticky top-24 hidden lg:col-span-4 lg:block">
          <ChatPanel className="h-[calc(100dvh-8rem)] max-h-[780px]" />
        </aside>
      </div>
    </>
  );
}
