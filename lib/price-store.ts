import "server-only";
import { adminClient } from "@/lib/supabase/admin";

/** One mandi price row, per quintal, exactly as the source reports it. */
export type PriceRow = {
  arrival_date: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  source: string;
  fetched_at: string;
};

/** Upserts prices (one row per date + mandi + crop + variety + grade) and records new mandis. */
export async function savePriceRows(rows: PriceRow[]): Promise<{ saved: number; error?: string }> {
  const db = adminClient();
  const unique = new Map(rows.map((r) => [`${r.arrival_date}|${r.market}|${r.commodity}|${r.variety}|${r.grade}`, r]));
  const deduped = [...unique.values()];

  for (let i = 0; i < deduped.length; i += 500) {
    const { error } = await db.from("prices").upsert(deduped.slice(i, i + 500), { onConflict: "arrival_date,market,commodity,variety,grade" });
    if (error) return { saved: i, error: error.message };
  }

  const markets = new Map(deduped.map((r) => [`${r.market}|${r.district}`, { market: r.market, district: r.district, state: r.state }]));
  if (markets.size) {
    await db.from("markets").upsert([...markets.values()], { onConflict: "market,district", ignoreDuplicates: true });
  }
  return { saved: deduped.length };
}
