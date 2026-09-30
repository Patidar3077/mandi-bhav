import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { mappedCommodities, syncAgmarknet, type AgmSyncResult } from "@/lib/agmarknet";
import { startMandiRun, type StartResult } from "@/lib/apify";
import { addDays, todayIST } from "@/lib/format";

/** Crops are split into this many groups, each synced by its own cron job, so each run stays well under 5 minutes. */
export const SYNC_PARTS = 4;

/**
 * Sync today's and yesterday's prices for one group of crops from Agmarknet.
 * If Agmarknet fails completely, start one Apify / data.gov.in run as a fallback (at most one per 3 hours).
 */
export async function runDailySyncPart(part: number): Promise<{ agmarknet: AgmSyncResult; apify?: StartResult | "recently-started" }> {
  const all = (await mappedCommodities()).map((c) => c.data_name).sort();
  const crops = all.filter((_, i) => i % SYNC_PARTS === part);
  const today = todayIST();
  const agmarknet = await syncAgmarknet({ dates: [today, addDays(today, -1)], commodities: crops });

  const failedCompletely = agmarknet.requests > 0 && agmarknet.failures === agmarknet.requests;
  if (!failedCompletely) return { agmarknet };

  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: recent } = await adminClient().from("sync_runs").select("id").eq("type", "daily").gte("started_at", since).limit(1);
  if (recent?.length) return { agmarknet, apify: "recently-started" };
  return { agmarknet, apify: await startMandiRun({ type: "daily" }) };
}
