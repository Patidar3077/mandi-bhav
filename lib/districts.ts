import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { listDistricts, listMarkets } from "@/lib/prices";

/** Districts, markets and the neighbour map used by the selectors. */
export async function getPlaceOptions() {
  const [districts, markets, { data: pairs }] = await Promise.all([
    listDistricts(),
    listMarkets(),
    adminClient().from("district_neighbours").select("district, neighbour"),
  ]);
  const neighbours: Record<string, string[]> = {};
  for (const p of pairs ?? []) (neighbours[p.district] ??= []).push(p.neighbour);
  return { districts, markets, neighbours };
}
