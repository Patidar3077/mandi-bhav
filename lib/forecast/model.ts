/**
 * Statistical forecast (PRD section 6). Pure functions, no I/O.
 * The AI never produces these numbers; it only explains them.
 */
import { addDays, daysBetween } from "../format";

export const METHOD_VERSION = "ma7-lr21-damped-v1";

export type Point = { date: string; price: number };
export type FilledPoint = { date: string; price: number | null; real: boolean };
export type Trend = "rising" | "falling" | "stable";
export type Confidence = "high" | "medium" | "low";

export type ForecastDay = { date: string; low: number; mid: number; high: number };
export type ForecastWeek = { week: number; start: string; end: string; low: number; mid: number; high: number };

export type ForecastResult = {
  method: string;
  lastDate: string | null;
  lastPrice: number | null;
  totalDays: number;
  realDays: number;
  trend: Trend | null;
  trendPct: number | null;
  sevenDay: { ok: true; days: ForecastDay[]; confidence: Confidence } | { ok: false; daysNeeded: number };
  weeks: { ok: true; weeks: ForecastWeek[]; confidence: Confidence } | { ok: false; daysNeeded: number };
};

const MAX_CARRY_FORWARD = 3;
const REQ_7D = { total: 21, real: 15 };
const REQ_4W = { total: 60, real: 40 };
const WEEK_DAMPING = 0.7;
const RANGE_Z = 1.5;
const FLOOR_RATIO = 0.3;

/** Daily series from first to last date; gaps up to 3 days carry the last price, longer gaps stay empty. */
export function fillSeries(points: Point[]): FilledPoint[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((p) => [p.date, p.price]));
  const out: FilledPoint[] = [];
  let last: number | null = null;
  let gap = 0;
  const span = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  for (let i = 0; i <= span; i++) {
    const date = addDays(sorted[0].date, i);
    const price = byDate.get(date);
    if (price !== undefined) {
      out.push({ date, price, real: true });
      last = price;
      gap = 0;
    } else {
      gap++;
      out.push({ date, price: gap <= MAX_CARRY_FORWARD ? last : null, real: false });
    }
  }
  return out;
}

/** Trailing 7-day moving average over available values (needs at least 4 in the window). */
export function movingAverage(series: FilledPoint[], window = 7): (number | null)[] {
  return series.map((_, i) => {
    const vals = series
      .slice(Math.max(0, i - window + 1), i + 1)
      .map((p) => p.price)
      .filter((x): x is number => x !== null);
    return vals.length >= Math.min(4, window) ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Changes between consecutive real (not filled) days in the last `days` days. */
function dailyChanges(series: FilledPoint[], days: number) {
  const recent = series.slice(-days);
  const abs: number[] = [];
  const pct: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const a = recent[i - 1];
    const b = recent[i];
    if (a.real && b.real && a.price !== null && b.price !== null) {
      abs.push(b.price - a.price);
      pct.push(a.price ? ((b.price - a.price) / a.price) * 100 : 0);
    }
  }
  return { abs, pct };
}

export function trendFrom(smoothed: (number | null)[]): { trend: Trend | null; pct: number | null } {
  const lastIdx = smoothed.length - 1;
  if (lastIdx < 7) return { trend: null, pct: null };
  const now = smoothed[lastIdx];
  const before = smoothed[lastIdx - 7];
  if (now === null || before === null || before === 0) return { trend: null, pct: null };
  const pct = ((now - before) / before) * 100;
  return { trend: pct > 3 ? "rising" : pct < -3 ? "falling" : "stable", pct };
}

function confidenceFor(series: FilledPoint[], required: number): Confidence {
  const { abs, pct } = dailyChanges(series, 30);
  const recentJump = dailyChanges(series, 15).pct.some((p) => Math.abs(p) > 20);
  const lastPrice = [...series].reverse().find((p) => p.price !== null)?.price ?? 1;
  const volatility = stdDev(abs) / lastPrice;
  if (recentJump || series.length < required * 1.2) return "low";
  if (volatility < 0.03 && series.length >= required * 2 && pct.length >= 10) return "high";
  return "medium";
}

export function forecast(points: Point[]): ForecastResult {
  const series = fillSeries(points);
  const realDays = series.filter((p) => p.real).length;
  const totalDays = series.length;
  const lastReal = [...series].reverse().find((p) => p.real) ?? null;
  const smoothed = movingAverage(series);
  const { trend, pct } = trendFrom(smoothed);

  const need = (req: { total: number; real: number }) => Math.max(req.total - totalDays, req.real - realDays, 0);

  const base: ForecastResult = {
    method: METHOD_VERSION,
    lastDate: series.at(-1)?.date ?? null,
    lastPrice: lastReal?.price ?? null,
    totalDays,
    realDays,
    trend,
    trendPct: pct,
    sevenDay: { ok: false, daysNeeded: need(REQ_7D) },
    weeks: { ok: false, daysNeeded: need(REQ_4W) },
  };
  if (need(REQ_7D) > 0 || !base.lastDate || base.lastPrice === null) return base;

  // Fit a line on the last 21 smoothed points.
  const xs: number[] = [];
  const ys: number[] = [];
  const start = Math.max(0, smoothed.length - 21);
  for (let i = start; i < smoothed.length; i++) {
    if (smoothed[i] !== null) {
      xs.push(i);
      ys.push(smoothed[i]!);
    }
  }
  if (xs.length < 8) return { ...base, sevenDay: { ok: false, daysNeeded: 7 } };

  const { slope, intercept } = linearRegression(xs, ys);
  const lastIdx = smoothed.length - 1;
  // A trailing 7-day average describes the price ~3 days earlier, so shift the line forward by that lag.
  const MA_LAG = 3;
  const anchor = intercept + slope * (lastIdx + MA_LAG);
  const sd = stdDev(dailyChanges(series, 30).abs);
  const floor = base.lastPrice * FLOOR_RATIO;
  const band = (mid: number, ahead: number) => {
    const half = RANGE_Z * sd * Math.sqrt(ahead);
    const m = Math.max(mid, floor);
    return { low: Math.round(Math.max(m - half, floor)), mid: Math.round(m), high: Math.round(m + half) };
  };

  const days: ForecastDay[] = [];
  for (let h = 1; h <= 7; h++) days.push({ date: addDays(base.lastDate, h), ...band(anchor + slope * h, h) });
  const result: ForecastResult = { ...base, sevenDay: { ok: true, days, confidence: confidenceFor(series, REQ_7D.total) } };

  if (need(REQ_4W) === 0) {
    const weeks: ForecastWeek[] = [];
    for (let w = 2; w <= 4; w++) {
      const startH = 7 * (w - 1) + 1;
      const centre = startH + 3;
      const mid = anchor + slope * 7 + slope * WEEK_DAMPING * (centre - 7);
      weeks.push({ week: w, start: addDays(base.lastDate, startH), end: addDays(base.lastDate, startH + 6), ...band(mid, centre) });
    }
    result.weeks = { ok: true, weeks, confidence: confidenceFor(series, REQ_4W.total) };
  }
  return result;
}
