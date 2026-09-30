import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { savePriceRows, type PriceRow } from "@/lib/price-store";
import { addDays, todayIST } from "@/lib/format";

/**
 * Main price source: Agmarknet's public "Market wise Daily Report" (api.agmarknet.gov.in), which gives
 * min / max / modal price and arrivals for every mandi, per crop, per date. Free, no key, no captcha.
 * Apify + data.gov.in (lib/apify.ts) is the fallback when this fails.
 */

const BASE = "https://api.agmarknet.gov.in/v1";
const HEADERS = {
  Origin: "https://agmarknet.gov.in",
  Referer: "https://agmarknet.gov.in/",
  "User-Agent": "MandiBhav/1.0 (+https://mandibhav.vercel.app)",
};
const MAHARASHTRA_ID = 20;
const LIVE_DEDUPE_MINUTES = 30;

// Agmarknet uses some newer or different district names than our neighbour table.
const DISTRICT_ALIASES: Record<string, string> = {
  Ahilyanagar: "Ahmednagar",
  Amarawati: "Amravati",
  "Chattrapati Sambhajinagar": "Aurangabad",
  Dharashiv: "Osmanabad",
  Murum: "Osmanabad",
  Gondiya: "Gondia",
  "Bandra(E)": "Mumbai",
};

export type AgmCommodity = { data_name: string; agmarknet_id: number; agmarknet_group_id: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with retries: Agmarknet answers 429 when requests overlap, so back off and try again. */
async function getJson(path: string, timeoutMs = 45_000) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`Agmarknet ${res.status} for ${path.split("?")[0]}`);
  }
}

// market id → district (our naming). The filter list is ~0.5 MB, so keep it for a few hours per server instance.
let marketCache: { at: number; districts: Map<number, string> } | null = null;
async function marketDistricts() {
  if (marketCache && Date.now() - marketCache.at < 6 * 3600_000) return marketCache.districts;
  const json = (await getJson("/daily-price-arrival/filters", 60_000)) as {
    data: {
      district_data: { id: number; state_id: number | null; district_name: string }[];
      market_data: { id: number; district_id: number | null; state_id: number | null }[];
    };
  };
  const districtName = new Map(
    json.data.district_data
      .filter((d) => d.state_id === MAHARASHTRA_ID)
      .map((d) => [d.id, DISTRICT_ALIASES[d.district_name.trim()] ?? d.district_name.trim()]),
  );
  const districts = new Map<number, string>();
  for (const m of json.data.market_data) {
    if (m.state_id === MAHARASHTRA_ID && m.district_id !== null && districtName.has(m.district_id)) {
      districts.set(m.id, districtName.get(m.district_id)!);
    }
  }
  marketCache = { at: Date.now(), districts };
  return districts;
}

type ReportRow = {
  variety?: string;
  grade?: string;
  minimumPrice?: number | string;
  maximumPrice?: number | string;
  modalPrice?: number | string;
  unitOfPrice?: string;
};
type Report = { states?: { stateId: number; markets: { marketId: number; marketName: string; data?: ReportRow[] }[] }[] };

const price = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Maharashtra prices for one crop on one date. */
export async function fetchCommodityDay(c: AgmCommodity, date: string): Promise<PriceRow[]> {
  const qs = new URLSearchParams({
    date,
    commodityGroupId: String(c.agmarknet_group_id),
    commodityId: String(c.agmarknet_id),
    includeExcel: "false",
  });
  const districts = await marketDistricts();
  const report = (await getJson(`/prices-and-arrivals/market-report/specific?${qs}`)) as Report;
  const mh = report.states?.find((s) => s.stateId === MAHARASHTRA_ID);
  const fetchedAt = new Date().toISOString();
  const rows: PriceRow[] = [];
  for (const m of mh?.markets ?? []) {
    const district = districts.get(m.marketId);
    if (!district) continue;
    for (const r of m.data ?? []) {
      const modal = price(r.modalPrice);
      if (!modal || (r.unitOfPrice && !/quintal/i.test(r.unitOfPrice))) continue;
      rows.push({
        arrival_date: date,
        state: "Maharashtra",
        district,
        market: m.marketName.trim(),
        commodity: c.data_name,
        variety: (r.variety ?? "").trim(),
        grade: (r.grade ?? "").trim(),
        min_price: price(r.minimumPrice),
        max_price: price(r.maximumPrice),
        modal_price: modal,
        source: "agmarknet",
        fetched_at: fetchedAt,
      });
    }
  }
  return rows;
}

export async function mappedCommodities(names?: string[]): Promise<AgmCommodity[]> {
  let q = adminClient().from("commodities").select("data_name, agmarknet_id, agmarknet_group_id").not("agmarknet_id", "is", null);
  if (names?.length) q = q.in("data_name", names);
  const { data } = await q;
  return (data ?? []) as AgmCommodity[];
}

/** Run tasks with a small concurrency limit, to be gentle with the government server. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

export type AgmSyncResult = { rowsSaved: number; requests: number; failures: number; error?: string };

/** Fetch and save prices for the given dates and crops. Logged in sync_runs (type "agmarknet"). */
export async function syncAgmarknet(opts: { dates: string[]; commodities?: string[]; concurrency?: number; filterKey?: string }): Promise<AgmSyncResult> {
  const db = adminClient();
  const crops = await mappedCommodities(opts.commodities);
  const { data: run } = await db
    .from("sync_runs")
    .insert({ type: "agmarknet", status: "running", filters: { dates: opts.dates, commodities: opts.commodities ?? "all" }, filter_key: opts.filterKey ?? null })
    .select("id")
    .single();

  const jobs = opts.dates.flatMap((date) => crops.map((c) => ({ date, c })));
  const rows: PriceRow[] = [];
  let failures = 0;
  let lastError: string | undefined;
  await pool(jobs, opts.concurrency ?? 1, async ({ date, c }) => {
    try {
      rows.push(...(await fetchCommodityDay(c, date)));
    } catch (err) {
      failures++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  });

  const saved = await savePriceRows(rows);
  const failedAll = jobs.length > 0 && failures === jobs.length;
  if (run) {
    await db
      .from("sync_runs")
      .update({
        status: failedAll || saved.error ? "failed" : "succeeded",
        rows_saved: saved.saved,
        finished_at: new Date().toISOString(),
        error: saved.error ?? (failures ? `${failures}/${jobs.length} requests failed: ${lastError}` : null),
      })
      .eq("id", run.id);
  }
  return { rowsSaved: saved.saved, requests: jobs.length, failures, error: saved.error ?? (failedAll ? lastError : undefined) };
}

/** Quick fetch of today's and yesterday's prices for one crop (used by live search and the chatbot). */
export async function liveAgmarknet(commodity: string): Promise<AgmSyncResult | { skipped: true }> {
  const filterKey = `agm:${commodity.toLowerCase()}`;
  const since = new Date(Date.now() - LIVE_DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await adminClient()
    .from("sync_runs")
    .select("id")
    .eq("filter_key", filterKey)
    .eq("status", "succeeded")
    .gte("started_at", since)
    .limit(1);
  if (recent?.length) return { skipped: true };
  const today = todayIST();
  return syncAgmarknet({ dates: [today, addDays(today, -1)], commodities: [commodity], filterKey });
}
