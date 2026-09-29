import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { addDays, todayIST } from "@/lib/format";
import { fallbackCommodity, type Commodity } from "@/lib/commodities";

/** Prices are stored per quintal, exactly as data.gov.in reports them. */
export type DayPrice = {
  date: string;
  modal: number;
  min: number | null;
  max: number | null;
  varieties: string[];
};

export type MarketRow = {
  market: string;
  district: string;
  latest: DayPrice;
  previous: DayPrice | null; // the calendar day before `latest`, if reported
  change: number | null; // latest.modal - previous.modal
  changePct: number | null;
  reportedToday: boolean;
};

export type Snapshot = {
  commodity: string;
  district: string;
  market: string | null;
  today: string;
  districts: string[];
  /** Headline numbers: for one mandi, or the average across nearby mandis. */
  headline: {
    latest: DayPrice | null;
    today: number | null;
    yesterday: number | null;
    dayBefore: number | null;
    change: number | null;
    changePct: number | null;
  };
  avgNearby: { value: number; date: string } | null;
  markets: MarketRow[];
  bestMarket: string | null;
  hasTodayForDistrict: boolean;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export async function getNeighbours(district: string): Promise<string[]> {
  const { data } = await adminClient().from("district_neighbours").select("neighbour").eq("district", district);
  return [district, ...(data ?? []).map((r) => r.neighbour as string)];
}

export async function listDistricts(): Promise<string[]> {
  const db = adminClient();
  const [{ data: n }, { data: m }] = await Promise.all([
    db.from("district_neighbours").select("district"),
    db.from("markets").select("district"),
  ]);
  const set = new Set<string>([...(n ?? []), ...(m ?? [])].map((r) => r.district as string));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function listMarkets(districts?: string[]): Promise<{ market: string; district: string }[]> {
  let q = adminClient().from("markets").select("market, district").order("market");
  if (districts?.length) q = q.in("district", districts);
  const { data } = await q.limit(2000);
  return (data ?? []) as { market: string; district: string }[];
}

export async function listCommodities(): Promise<Commodity[]> {
  const db = adminClient();
  const [{ data: known }, { data: seen }] = await Promise.all([
    db.from("commodities").select("data_name, name_en, name_hi, name_mr, aliases, is_quick_pick").order("name_en"),
    db.from("price_commodities").select("commodity").limit(1000),
  ]);
  const list = (known ?? []) as Commodity[];
  const names = new Set(list.map((c) => c.data_name));
  for (const row of seen ?? []) {
    const name = row.commodity as string;
    if (!names.has(name)) list.push(fallbackCommodity(name));
  }
  return list;
}

type RawRow = {
  arrival_date: string;
  district: string;
  market: string;
  variety: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
};

async function fetchRows(commodity: string, districts: string[], sinceDate: string, market?: string | null) {
  const rows: RawRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = adminClient()
      .from("prices")
      .select("arrival_date, district, market, variety, min_price, max_price, modal_price")
      .eq("commodity", commodity)
      .gte("arrival_date", sinceDate)
      .order("arrival_date", { ascending: false })
      .range(from, from + 999);
    q = market ? q.eq("market", market) : q.in("district", districts);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as RawRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Collapse varieties/grades into one price per market per day. */
function byMarketDay(rows: RawRow[]) {
  const map = new Map<string, Map<string, DayPrice & { district: string }>>();
  for (const r of rows) {
    const byDay = map.get(r.market) ?? new Map();
    map.set(r.market, byDay);
    const cur = byDay.get(r.arrival_date);
    const modal = Number(r.modal_price);
    const min = r.min_price === null ? null : Number(r.min_price);
    const max = r.max_price === null ? null : Number(r.max_price);
    if (!cur) {
      byDay.set(r.arrival_date, {
        date: r.arrival_date,
        district: r.district,
        modal,
        min,
        max,
        varieties: r.variety ? [r.variety] : [],
        _modals: [modal],
      } as DayPrice & { district: string; _modals: number[] });
    } else {
      const c = cur as DayPrice & { _modals: number[] };
      c._modals.push(modal);
      c.modal = mean(c._modals);
      c.min = min === null ? c.min : c.min === null ? min : Math.min(c.min, min);
      c.max = max === null ? c.max : c.max === null ? max : Math.max(c.max, max);
      if (r.variety && !c.varieties.includes(r.variety)) c.varieties.push(r.variety);
    }
  }
  return map;
}

const clean = (d: DayPrice): DayPrice => ({
  date: d.date,
  modal: Math.round(d.modal),
  min: d.min,
  max: d.max,
  varieties: d.varieties,
});

export async function getSnapshot(opts: { commodity: string; district: string; market?: string | null }): Promise<Snapshot> {
  const today = todayIST();
  const districts = await getNeighbours(opts.district);
  const rows = await fetchRows(opts.commodity, districts, addDays(today, -45));
  const grouped = byMarketDay(rows);

  const markets: MarketRow[] = [];
  for (const [market, days] of grouped) {
    const dates = [...days.keys()].sort().reverse();
    const latest = days.get(dates[0])!;
    const prev = days.get(addDays(latest.date, -1)) ?? null;
    const change = prev ? latest.modal - prev.modal : null;
    markets.push({
      market,
      district: latest.district,
      latest: clean(latest),
      previous: prev ? clean(prev) : null,
      change: change === null ? null : Math.round(change),
      changePct: change === null || !prev ? null : (change / prev.modal) * 100,
      reportedToday: latest.date === today,
    });
  }
  markets.sort((a, b) => b.latest.date.localeCompare(a.latest.date) || b.latest.modal - a.latest.modal);

  // Best price among mandis reporting on the most recent date anyone reported.
  const newestDate = markets[0]?.latest.date ?? null;
  const current = markets.filter((m) => m.latest.date === newestDate);
  const bestMarket = current.length ? current.reduce((a, b) => (b.latest.modal > a.latest.modal ? b : a)).market : null;
  const avgNearby = current.length && newestDate ? { value: Math.round(mean(current.map((m) => m.latest.modal))), date: newestDate } : null;

  // Headline: a specific mandi, or the average across nearby mandis per day.
  const dayValue = (date: string): DayPrice | null => {
    if (opts.market) {
      const d = grouped.get(opts.market)?.get(date);
      return d ? clean(d) : null;
    }
    const list = [...grouped.values()].map((m) => m.get(date)).filter(Boolean) as DayPrice[];
    if (!list.length) return null;
    const mins = list.map((d) => d.min).filter((x): x is number => x !== null);
    const maxs = list.map((d) => d.max).filter((x): x is number => x !== null);
    return {
      date,
      modal: Math.round(mean(list.map((d) => d.modal))),
      min: mins.length ? Math.min(...mins) : null,
      max: maxs.length ? Math.max(...maxs) : null,
      varieties: [],
    };
  };

  const latestDate = opts.market
    ? [...(grouped.get(opts.market)?.keys() ?? [])].sort().reverse()[0] ?? null
    : newestDate;
  const latest = latestDate ? dayValue(latestDate) : null;
  const prev = latestDate ? dayValue(addDays(latestDate, -1)) : null;
  const change = latest && prev ? latest.modal - prev.modal : null;

  return {
    commodity: opts.commodity,
    district: opts.district,
    market: opts.market ?? null,
    today,
    districts,
    headline: {
      latest,
      today: dayValue(today)?.modal ?? null,
      yesterday: dayValue(addDays(today, -1))?.modal ?? null,
      dayBefore: dayValue(addDays(today, -2))?.modal ?? null,
      change,
      changePct: change !== null && prev ? (change / prev.modal) * 100 : null,
    },
    avgNearby,
    markets,
    bestMarket,
    hasTodayForDistrict: markets.some((m) => m.district === opts.district && m.reportedToday),
  };
}

/** Daily modal series (ascending) for one mandi, or the average across a set of districts. */
export async function getDailySeries(opts: {
  commodity: string;
  districts: string[];
  market?: string | null;
  days: number;
}): Promise<{ date: string; price: number }[]> {
  const since = addDays(todayIST(), -opts.days);
  const rows = await fetchRows(opts.commodity, opts.districts, since, opts.market);
  const grouped = byMarketDay(rows);
  const perDay = new Map<string, number[]>();
  for (const days of grouped.values()) {
    for (const d of days.values()) {
      const list = perDay.get(d.date) ?? [];
      list.push(d.modal);
      perDay.set(d.date, list);
    }
  }
  return [...perDay.entries()]
    .map(([date, xs]) => ({ date, price: Math.round(mean(xs)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
