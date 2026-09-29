"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/client";
import { addDays, daysBetween, formatDate, formatINR } from "@/lib/format";

type Props = {
  series: { date: string; price: number }[];
  forecast: { date: string; low: number; mid: number; high: number }[];
};

type Row = { date: string; actual?: number; forecast?: number; band?: [number, number] };

const RANGES = [7, 30, 90] as const;

export function TrendChart({ series, forecast }: Props) {
  const { t, locale } = useI18n();
  const span = series.length ? daysBetween(series[0].date, series[series.length - 1].date) + 1 : 0;
  // Only offer ranges we actually have data for.
  const available = RANGES.filter((r, i) => i === 0 || span > RANGES[i - 1]);
  const [range, setRange] = useState<(typeof RANGES)[number]>(available.includes(30) ? 30 : 7);

  const data = useMemo(() => {
    if (!series.length) return [];
    const last = series[series.length - 1];
    const from = addDays(last.date, -(range - 1));
    const rows: Row[] = series.filter((p) => p.date >= from).map((p) => ({ date: p.date, actual: p.price }));
    if (forecast.length) {
      // Start the dotted forecast line from the last real price.
      rows[rows.length - 1] = { ...rows[rows.length - 1], forecast: last.price, band: [last.price, last.price] };
      for (const f of forecast) rows.push({ date: f.date, forecast: f.mid, band: [f.low, f.high] });
    }
    return rows;
  }, [series, forecast, range]);

  if (series.length < 2) {
    return <p className="rounded-xl bg-cream p-4 text-[15px] text-muted">{t("analysis.chartNoData")}</p>;
  }

  const lastDate = series[series.length - 1].date;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full bg-fresh" /> {t("analysis.actual")}
          </span>
          {forecast.length > 0 && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-leaf" /> {t("analysis.forecast")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-sm bg-fresh/25" /> {t("analysis.range")}
              </span>
            </>
          )}
        </div>
        {available.length > 1 && (
          <div className="flex items-center rounded-xl bg-cream p-1" role="group">
            {available.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${range === r ? "bg-leaf-deep text-card shadow-card" : "text-muted hover:text-ink"}`}
              >
                {t(`analysis.d${r}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-64 w-full rounded-xl bg-cream/40 p-2 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2d7c3" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d, locale, false)}
              tick={{ fontSize: 11, fill: "#6e6155" }}
              tickLine={false}
              axisLine={{ stroke: "#e2d7c3" }}
              minTickGap={24}
            />
            <YAxis
              width={64}
              tickFormatter={(v: number) => formatINR(v, locale)}
              tick={{ fontSize: 11, fill: "#6e6155" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(d) => formatDate(String(d), locale)}
              formatter={(value, name) => {
                const label = name === "band" ? t("analysis.range") : name === "forecast" ? t("analysis.forecast") : t("analysis.actual");
                const text = Array.isArray(value)
                  ? `${formatINR(Number(value[0]), locale)} – ${formatINR(Number(value[1]), locale)}`
                  : formatINR(Number(value), locale);
                return [text, label];
              }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2d7c3", background: "#fffbf4", fontSize: 13 }}
            />
            {forecast.length > 0 && <ReferenceLine x={lastDate} stroke="#7a5230" strokeDasharray="4 4" />}
            <Area dataKey="band" stroke="none" fill="#6ba368" fillOpacity={0.22} isAnimationActive={false} connectNulls />
            <Line dataKey="actual" stroke="#6ba368" strokeWidth={3} dot={{ r: 3, fill: "#fffbf4", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
            <Line dataKey="forecast" stroke="#2f5d3a" strokeWidth={2.5} strokeDasharray="6 5" dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
