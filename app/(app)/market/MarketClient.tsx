"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ChangeBadge } from "@/components/ChangeBadge";
import { ChatViewing } from "@/components/chat/ChatProvider";
import { useI18n } from "@/lib/i18n/client";
import { commodityLabel, fallbackCommodity, searchCommodities, type Commodity } from "@/lib/commodities";
import { formatDate, formatINR, formatPerKg } from "@/lib/format";
import type { Snapshot } from "@/lib/prices";

type Props = {
  commodities: Commodity[];
  districts: string[];
  markets: { market: string; district: string }[];
  neighbours: Record<string, string[]>;
  recent: string[];
  initial: { crop: string; district: string; market: string };
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "live" }
  | { kind: "limit"; message: string }
  | { kind: "error" };

const LIVE_POLL_MS = 3000;
const LIVE_GIVE_UP_MS = 90_000;

export function MarketClient({ commodities, districts, markets, neighbours, recent, initial }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const byName = useMemo(() => new Map(commodities.map((c) => [c.data_name, c])), [commodities]);

  const [crop, setCrop] = useState<Commodity | null>(initial.crop ? byName.get(initial.crop) ?? fallbackCommodity(initial.crop) : null);
  const [query, setQuery] = useState(crop ? commodityLabel(crop, locale) : "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [district, setDistrict] = useState(initial.district);
  const [market, setMarket] = useState(initial.market);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [liveFailed, setLiveFailed] = useState(false);
  const autoRan = useRef(false);

  const suggestions = useMemo(() => searchCommodities(commodities, query, 8), [commodities, query]);
  const quickPicks = useMemo(() => commodities.filter((c) => c.is_quick_pick), [commodities]);
  const recentCrops = useMemo(
    () => recent.map((name) => byName.get(name) ?? fallbackCommodity(name)).filter((c) => !c.is_quick_pick),
    [recent, byName],
  );
  const nearbyMarkets = useMemo(() => {
    const allowed = new Set([district, ...(neighbours[district] ?? [])]);
    return markets.filter((m) => allowed.has(m.district));
  }, [district, markets, neighbours]);

  const fetchSnapshot = useCallback(async (c: Commodity, d: string, m: string) => {
    const qs = new URLSearchParams({ commodity: c.data_name, district: d, ...(m ? { market: m } : {}) });
    const res = await fetch(`/api/prices?${qs}`);
    if (res.status === 429) {
      const body = (await res.json()) as { reason: string; limit: number };
      const key = body.reason === "fairUse" ? "limits.fairUse" : "limits.search";
      return { limit: `${t(key, { n: body.limit })} ${t("common.paidSoon")}.` };
    }
    if (!res.ok) throw new Error("prices failed");
    return { snapshot: ((await res.json()) as { snapshot: Snapshot }).snapshot };
  }, [t]);

  const liveFetch = useCallback(async (c: Commodity, d: string) => {
    const started = Date.now();
    const res = await fetch("/api/live-fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commodity: c.data_name, district: d }),
    });
    if (!res.ok) return false;
    let body = (await res.json()) as { status: string; runId?: string };
    while (body.status === "running" && body.runId && Date.now() - started < LIVE_GIVE_UP_MS) {
      await new Promise((r) => setTimeout(r, LIVE_POLL_MS));
      const poll = await fetch(`/api/live-fetch?runId=${encodeURIComponent(body.runId)}`);
      if (!poll.ok) return false;
      body = await poll.json();
    }
    return body.status === "succeeded";
  }, []);

  const check = useCallback(
    async (c: Commodity | null, d: string, m: string) => {
      if (!c) {
        setStatus({ kind: "error" });
        return;
      }
      setStatus({ kind: "loading" });
      setLiveFailed(false);
      setShowSuggestions(false);
      const qs = new URLSearchParams({ crop: c.data_name, district: d, ...(m ? { market: m } : {}) });
      router.replace(`/market?${qs}`, { scroll: false });
      try {
        const first = await fetchSnapshot(c, d, m);
        if ("limit" in first) return setStatus({ kind: "limit", message: first.limit! });
        setSnapshot(first.snapshot);
        if (first.snapshot.hasTodayForDistrict) return setStatus({ kind: "idle" });

        // No price for today in this district yet: fetch it live from the mandi data.
        setStatus({ kind: "live" });
        const ok = await liveFetch(c, d);
        if (ok) {
          const again = await fetchSnapshot(c, d, m);
          if ("snapshot" in again && again.snapshot) setSnapshot(again.snapshot);
        }
        setLiveFailed(!ok);
        setStatus({ kind: "idle" });
      } catch {
        setStatus({ kind: "error" });
      }
    },
    [fetchSnapshot, liveFetch, router],
  );

  useEffect(() => {
    if (!autoRan.current && crop && initial.crop) {
      autoRan.current = true;
      check(crop, district, market);
    }
  }, [check, crop, district, market, initial.crop]);

  const pick = (c: Commodity) => {
    setCrop(c);
    setQuery(commodityLabel(c, locale));
    setShowSuggestions(false);
  };

  const busy = status.kind === "loading" || status.kind === "live";
  const cropName = crop ? commodityLabel(crop, locale) : "";
  const analysisHref = crop
    ? `/analysis/${encodeURIComponent(crop.data_name)}?${new URLSearchParams({ district, ...(market ? { market } : {}) })}`
    : "#";

  return (
    <div className="flex flex-col gap-6">
      {crop && snapshot && <ChatViewing commodity={crop.data_name} district={district} market={market || null} />}

      <section className="card p-4 sm:p-6">
        <h1 className="mb-4 text-[22px] font-bold leading-[30px] text-leaf-deep sm:text-[28px] sm:leading-9">{t("market.title")}</h1>

        <div className="relative">
          <label htmlFor="crop" className="mb-1.5 block text-sm font-semibold">
            {t("market.cropLabel")}
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[22px] text-muted" />
            <input
              id="crop"
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls="crop-suggestions"
              autoComplete="off"
              value={query}
              placeholder={t("market.cropPlaceholder")}
              onChange={(e) => {
                setQuery(e.target.value);
                setCrop(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) {
                  e.preventDefault();
                  pick(suggestions[0]);
                }
              }}
              className="field pl-11"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && !crop && (
            <ul id="crop-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-card shadow-float">
              {suggestions.map((c) => (
                <li key={c.data_name} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left hover:bg-soil"
                  >
                    <span className="font-semibold">{commodityLabel(c, locale)}</span>
                    <span className="text-[11px] text-muted">{[c.name_en, c.name_hi, c.name_mr].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">{t("market.quickPicks")}</span>
          <div className="flex flex-wrap gap-2">
            {[...quickPicks, ...recentCrops].map((c) => (
              <button
                key={c.data_name}
                type="button"
                onClick={() => pick(c)}
                aria-pressed={crop?.data_name === c.data_name}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                  crop?.data_name === c.data_name ? "bg-leaf text-card" : "border border-line bg-soil text-ink hover:bg-sand"
                }`}
              >
                {commodityLabel(c, locale)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("market.districtLabel")}</span>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setMarket("");
              }}
              className="field"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("market.mandiLabel")}</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)} className="field">
              <option value="">{t("market.allNearby")}</option>
              {nearbyMarkets.map((m) => (
                <option key={`${m.market}|${m.district}`} value={m.market}>
                  {m.market} ({m.district})
                </option>
              ))}
            </select>
          </label>
        </div>

        {status.kind === "error" && !crop && (
          <p role="alert" className="mt-3 text-sm text-down">
            {t("market.selectCrop")}
          </p>
        )}

        <button type="button" className="btn-primary mt-5 w-full text-lg sm:w-auto" disabled={busy} onClick={() => check(crop, district, market)}>
          {busy ? <Icon name="progress_activity" className="animate-spin text-[20px]" /> : <Icon name="search" className="text-[20px]" />}
          {t("market.check")}
        </button>
      </section>

      {status.kind === "live" && (
        <div role="status" className="card flex items-center gap-3 p-4 text-[15px] font-semibold text-leaf">
          <Icon name="progress_activity" className="animate-spin text-[22px]" />
          {t("market.fetchingLive")}
        </div>
      )}
      {status.kind === "limit" && (
        <p role="alert" className="card border-down/30 bg-down-bg p-4 text-[15px] text-down">
          {status.message}
        </p>
      )}
      {status.kind === "error" && crop && (
        <p role="alert" className="card bg-down-bg p-4 text-[15px] text-down">
          {t("common.error")}
        </p>
      )}

      {snapshot && crop && status.kind !== "loading" && (
        <Results snapshot={snapshot} cropName={cropName} liveFailed={liveFailed} analysisHref={analysisHref} />
      )}
    </div>
  );
}

function Results({ snapshot, cropName, liveFailed, analysisHref }: { snapshot: Snapshot; cropName: string; liveFailed: boolean; analysisHref: string }) {
  const { t, locale } = useI18n();
  const h = snapshot.headline;
  const place = snapshot.market ?? `${snapshot.district} · ${t("market.allNearby")}`;

  if (!h.latest) {
    return (
      <section className="card p-5">
        <p className="text-[17px] font-semibold">{t("market.noData", { crop: cropName, district: snapshot.district })}</p>
        <p className="mt-1 text-[15px] text-muted">{t("market.noDataHint")}</p>
      </section>
    );
  }

  const isToday = h.latest.date === snapshot.today;
  const dayCell = (label: string, value: number | null) => (
    <div className="rounded-xl bg-cream p-3">
      <span className="block text-[13px] text-brown">{label}</span>
      <span className={`block text-lg font-bold tabular ${value === null ? "text-muted" : "text-ink"}`}>
        {value === null ? t("common.notReported") : formatINR(value, locale)}
      </span>
    </div>
  );

  return (
    <>
      {liveFailed && <p className="card bg-cream p-4 text-[15px] text-brown">{t("market.liveFailed")}</p>}

      <section className="card relative overflow-hidden p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-leaf-soft/30 blur-2xl" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-leaf-deep">{t("market.showingFor", { crop: cropName, place })}</h2>
            <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-semibold text-brown shadow-card">
              <span className={`h-2 w-2 rounded-full ${isToday ? "pulse-dot bg-leaf" : "bg-muted"}`} />
              {t("common.pricesFor", { date: formatDate(h.latest.date, locale) })}
            </span>
          </div>

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <span className="text-sm text-brown">{isToday ? t("market.todayPrice") : t("market.latestPrice")}</span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[32px] font-extrabold leading-[38px] tracking-tight text-leaf-deep tabular sm:text-4xl">
                  {formatINR(h.latest.modal, locale)}
                </span>
                <span className="text-[17px] text-brown">
                  {t("common.perQuintal")} ({formatPerKg(h.latest.modal, locale)} {t("common.perKg")})
                </span>
              </div>
              {h.latest.varieties.length > 0 && (
                <span className="text-[13px] text-muted">{t("market.variety", { v: h.latest.varieties.slice(0, 3).join(", ") })}</span>
              )}
            </div>
            <div className="flex flex-col gap-1 md:items-end">
              <span className="text-[13px] text-muted">{t("market.changeVsYesterday")}</span>
              {h.change === null ? <span className="text-sm text-muted">{t("common.notReported")}</span> : <ChangeBadge change={h.change} pct={h.changePct} />}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {dayCell(t("common.today"), h.today)}
            {dayCell(t("common.yesterday"), h.yesterday)}
            {dayCell(t("common.dayBefore"), h.dayBefore)}
          </div>

          <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <dt className="text-[13px] text-brown">{t("market.minPrice")}</dt>
              <dd className="font-bold tabular">{formatINR(h.latest.min, locale)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-brown">{t("market.maxPrice")}</dt>
              <dd className="font-bold tabular">{formatINR(h.latest.max, locale)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-brown">{t("market.avgNearby")}</dt>
              <dd className="font-bold tabular">{formatINR(snapshot.avgNearby?.value, locale)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-leaf-deep">
          <Icon name="storefront" /> {t("market.nearbyTitle")}
        </h2>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-brown">
                <th className="px-4 py-2 font-semibold sm:px-2">{t("market.colMandi")}</th>
                <th className="px-2 py-2 text-right font-semibold">{t("market.colModal")}</th>
                <th className="px-2 py-2 text-right font-semibold">{t("market.colMin")}</th>
                <th className="px-2 py-2 text-right font-semibold">{t("market.colMax")}</th>
                <th className="px-4 py-2 text-right font-semibold sm:px-2">{t("market.colChange")}</th>
              </tr>
            </thead>
            <tbody>
              {/* Already sorted: most recent reports first, highest price first. */}
              {snapshot.markets.map((m) => {
                  const stale = !m.reportedToday;
                  return (
                    <tr key={m.market} className={`border-b border-line/60 ${m.market === snapshot.market ? "bg-up-bg/60" : ""}`}>
                      <td className="px-4 py-3 sm:px-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`font-semibold ${stale ? "text-muted" : ""}`}>{m.market}</span>
                          {m.market === snapshot.bestMarket && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-peach px-1.5 text-[11px] font-bold text-brown">
                              <Icon name="star" filled className="text-[12px]" /> {t("market.bestPrice")}
                            </span>
                          )}
                        </div>
                        <span className={`text-[12px] ${stale ? "text-muted" : "text-brown"}`}>
                          {m.district} · {stale ? `${t("market.staleNote")} · ` : ""}
                          {formatDate(m.latest.date, locale, false)}
                        </span>
                      </td>
                      <td className={`px-2 py-3 text-right font-bold tabular ${stale ? "text-muted" : "text-leaf-deep"}`}>{formatINR(m.latest.modal, locale)}</td>
                      <td className="px-2 py-3 text-right tabular text-muted">{formatINR(m.latest.min, locale)}</td>
                      <td className="px-2 py-3 text-right tabular text-muted">{formatINR(m.latest.max, locale)}</td>
                      <td className="px-4 py-3 text-right sm:px-2">
                        {m.change === null ? <span className="text-muted">—</span> : <ChangeBadge change={m.change} size="sm" />}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <Link href={analysisHref} className="btn-primary w-full text-lg sm:w-auto sm:self-start">
        <Icon name="insights" className="text-[22px]" /> {t("market.analyze")}
      </Link>
    </>
  );
}
