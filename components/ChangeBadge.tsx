"use client";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";
import { formatPct, formatSignedINR } from "@/lib/format";

/** Green up / red down / neutral pill for a price change. */
export function ChangeBadge({ change, pct, suffix, size = "md" }: { change: number | null; pct?: number | null; suffix?: string; size?: "sm" | "md" }) {
  const { locale } = useI18n();
  if (change === null) return null;
  const up = change > 0;
  const down = change < 0;
  const tone = up ? "bg-up-bg text-leaf" : down ? "bg-down-bg text-down" : "bg-soil text-muted";
  const text = `${pct !== undefined && pct !== null ? `${formatPct(pct, locale)} ` : ""}(${formatSignedINR(change, locale)})`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold tabular ${tone} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm"}`}>
      <Icon name={up ? "arrow_upward" : down ? "arrow_downward" : "trending_flat"} className={size === "sm" ? "text-[14px]" : "text-[16px]"} />
      {text}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}
