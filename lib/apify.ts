import "server-only";
import { ApifyClient } from "apify-client";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

/**
 * The ONLY place that talks to Apify. Every run goes through startMandiRun(), which applies
 * dedupe (60 min for live fetches), maxResults, maxTotalChargeUsd and the daily spend cap,
 * and logs to sync_runs. Results are saved by ingestRun() (called from the webhook or polling).
 */

export const ACTOR_ID = "themineworks/india-data-gov-scraper";
export const MANDI_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

const PRICE_PER_RECORD_USD = 0.002;
const PRICE_PER_START_USD = 0.005;
const MIN_CHARGE_CAP_USD = 0.5; // Apify rejects a lower maxTotalChargeUsd
const LIVE_DEDUPE_MINUTES = 60;
const LIVE_MAX_RESULTS = 200;

type RunType = "daily" | "live";

export type StartResult =
  | { status: "started" | "reused"; syncRunId: number; apifyRunId: string }
  | { status: "capped" | "error"; message: string };

let apify: ApifyClient | null = null;
function client() {
  apify ??= new ApifyClient({ token: serverEnv.apifyToken() });
  return apify;
}

function estimateCost(maxResults: number) {
  return maxResults * PRICE_PER_RECORD_USD + PRICE_PER_START_USD;
}

function istMidnightUtcIso() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 5.5 * 3600 * 1000).toISOString();
}

/** Money spent (or reserved by running runs) since midnight IST. */
export async function spentTodayUsd() {
  const { data, error } = await adminClient()
    .from("sync_runs")
    .select("cost_usd")
    .gte("started_at", istMidnightUtcIso())
    .in("status", ["running", "succeeded", "failed"]);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}

export function liveFilterKey(district: string, commodity: string) {
  return `live:${district.trim().toLowerCase()}:${commodity.trim().toLowerCase()}`;
}

export async function startMandiRun(opts: {
  type: RunType;
  district?: string;
  commodity?: string;
  maxResults?: number;
}): Promise<StartResult> {
  const db = adminClient();
  const maxResults = opts.maxResults ?? (opts.type === "daily" ? serverEnv.dailySyncMaxResults() : LIVE_MAX_RESULTS);
  const filters = ["state=Maharashtra"];
  if (opts.district) filters.push(`district=${opts.district}`);
  if (opts.commodity) filters.push(`commodity=${opts.commodity}`);
  const filterKey =
    opts.type === "live" && opts.district && opts.commodity
      ? liveFilterKey(opts.district, opts.commodity)
      : `${opts.type}:${filters.join("|").toLowerCase()}`;

  // Dedupe: reuse a live fetch for the same crop + district from the last 60 minutes.
  if (opts.type === "live") {
    const since = new Date(Date.now() - LIVE_DEDUPE_MINUTES * 60_000).toISOString();
    const { data: recent } = await db
      .from("sync_runs")
      .select("id, apify_run_id, status")
      .eq("filter_key", filterKey)
      .gte("started_at", since)
      .in("status", ["running", "succeeded"])
      .order("started_at", { ascending: false })
      .limit(1);
    const hit = recent?.[0];
    if (hit?.apify_run_id) return { status: "reused", syncRunId: hit.id, apifyRunId: hit.apify_run_id };
  }

  // Daily spend cap.
  const estimate = estimateCost(maxResults);
  const cap = serverEnv.dailySpendCapUsd();
  const spent = await spentTodayUsd();
  if (spent + estimate > cap) {
    await db.from("sync_runs").insert({
      type: opts.type,
      filters,
      filter_key: filterKey,
      status: "skipped",
      finished_at: new Date().toISOString(),
      error: `Daily Apify spend cap reached ($${spent.toFixed(2)} of $${cap.toFixed(2)})`,
    });
    // Admin alert: visible in Vercel logs. Hook an email/Slack alert here when one is set up.
    console.error(`[apify] daily spend cap reached: spent=${spent.toFixed(3)} cap=${cap}`);
    return { status: "capped", message: "Daily data budget reached; serving stored prices only." };
  }

  // Reserve the estimated cost now so parallel requests respect the cap; replaced with the real cost later.
  const { data: row, error: insertError } = await db
    .from("sync_runs")
    .insert({ type: opts.type, filters, filter_key: filterKey, status: "running", cost_usd: estimate })
    .select("id")
    .single();
  if (insertError || !row) return { status: "error", message: insertError?.message ?? "could not log run" };

  try {
    const input: Record<string, unknown> = { resourceId: MANDI_RESOURCE_ID, filters, maxResults };
    const apiKey = serverEnv.dataGovApiKey();
    if (apiKey) input.apiKey = apiKey;

    const secret = encodeURIComponent(serverEnv.apifyWebhookSecret());
    const run = await client()
      .actor(ACTOR_ID)
      .start(input, {
        memory: 256,
        timeout: 300,
        maxTotalChargeUsd: Math.max(MIN_CHARGE_CAP_USD, Number((estimate * 1.2).toFixed(2))),
        webhooks: [
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
            requestUrl: `${serverEnv.siteUrl()}/api/sync/apify-webhook?secret=${secret}`,
          },
        ],
      });
    await db.from("sync_runs").update({ apify_run_id: run.id }).eq("id", row.id);
    return { status: "started", syncRunId: row.id, apifyRunId: run.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("sync_runs")
      .update({ status: "failed", error: message, cost_usd: 0, finished_at: new Date().toISOString() })
      .eq("id", row.id);
    console.error("[apify] start failed", message);
    return { status: "error", message };
  }
}

export type IngestResult = { status: "running" | "succeeded" | "failed"; rowsSaved: number; error?: string };

/** Saves a finished run's rows into `prices`. Safe to call more than once for the same run. */
export async function ingestRun(
  apifyRunId: string,
  opts: { waitSecs?: number; adoptScheduledRuns?: boolean } = {},
): Promise<IngestResult> {
  const db = adminClient();
  let { data: syncRun } = await db
    .from("sync_runs")
    .select("id, type, status, rows_saved, error")
    .eq("apify_run_id", apifyRunId)
    .maybeSingle();

  // Runs started by an Apify schedule (not by us) arrive via the webhook without a sync_runs row.
  if (!syncRun && opts.adoptScheduledRuns) {
    const [run, actor] = await Promise.all([client().run(apifyRunId).get(), client().actor(ACTOR_ID).get()]);
    if (run && actor && run.actId === actor.id) {
      const { data } = await db
        .from("sync_runs")
        .insert({ type: "webhook", apify_run_id: apifyRunId, filter_key: "webhook:scheduled", status: "running" })
        .select("id, type, status, rows_saved, error")
        .single();
      syncRun = data;
    }
  }
  if (!syncRun) throw new Error(`Unknown Apify run ${apifyRunId}`);
  if (syncRun.status === "succeeded") return { status: "succeeded", rowsSaved: syncRun.rows_saved };
  if (syncRun.status === "failed") return { status: "failed", rowsSaved: 0, error: syncRun.error ?? undefined };

  const runClient = client().run(apifyRunId);
  const run = opts.waitSecs ? await runClient.waitForFinish({ waitSecs: opts.waitSecs }) : await runClient.get();
  if (!run) throw new Error(`Apify run ${apifyRunId} not found`);

  if (run.status === "READY" || run.status === "RUNNING") return { status: "running", rowsSaved: 0 };

  const finishedAt = new Date().toISOString();
  const cost = typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : undefined;

  if (run.status !== "SUCCEEDED") {
    const error = `Apify run ended with status ${run.status}`;
    await db
      .from("sync_runs")
      .update({ status: "failed", error, finished_at: finishedAt, ...(cost !== undefined ? { cost_usd: cost } : {}) })
      .eq("id", syncRun.id);
    return { status: "failed", rowsSaved: 0, error };
  }

  const source = syncRun.type === "live" ? "live" : "sync";
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await client().dataset(run.defaultDatasetId).listItems({ offset, limit: 1000 });
    for (const item of page.items) rows.push(...normaliseItem(item, source));
    if (page.items.length < 1000) break;
  }

  // One row per (date, market, commodity, variety, grade); keep the last seen.
  const unique = new Map(rows.map((r) => [`${r.arrival_date}|${r.market}|${r.commodity}|${r.variety}|${r.grade}`, r]));
  const deduped = [...unique.values()];

  for (let i = 0; i < deduped.length; i += 500) {
    const chunk = deduped.slice(i, i + 500);
    const { error } = await db.from("prices").upsert(chunk, { onConflict: "arrival_date,market,commodity,variety,grade" });
    if (error) {
      await db.from("sync_runs").update({ status: "failed", error: error.message, finished_at: finishedAt }).eq("id", syncRun.id);
      return { status: "failed", rowsSaved: i, error: error.message };
    }
  }

  const markets = new Map(deduped.map((r) => [`${r.market}|${r.district}`, { market: r.market, district: r.district, state: r.state }]));
  if (markets.size) {
    await db.from("markets").upsert([...markets.values()], { onConflict: "market,district", ignoreDuplicates: true });
  }

  await db
    .from("sync_runs")
    .update({
      status: "succeeded",
      rows_saved: deduped.length,
      finished_at: finishedAt,
      ...(cost !== undefined ? { cost_usd: cost } : {}),
    })
    .eq("id", syncRun.id);

  return { status: "succeeded", rowsSaved: deduped.length };
}

type PriceRow = {
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

/** The actor's exact output shape is unconfirmed, so accept lower/Title case keys and nested record arrays. */
function normaliseItem(item: unknown, source: string): PriceRow[] {
  if (!item || typeof item !== "object") return [];
  const obj = item as Record<string, unknown>;
  if (obj._type === "summary") return [];
  if (Array.isArray(obj.records)) return obj.records.flatMap((r) => normaliseItem(r, source));
  const record = (obj.record && typeof obj.record === "object" ? obj.record : obj) as Record<string, unknown>;

  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) lower[k.toLowerCase()] = v;

  const text = (key: string) => (lower[key] === undefined || lower[key] === null ? "" : String(lower[key]).trim());
  const num = (key: string) => {
    const n = Number(String(lower[key] ?? "").replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const date = parseDate(text("arrival_date"));
  const modal = num("modal_price");
  const market = text("market");
  const commodity = text("commodity");
  if (!date || !modal || !market || !commodity) return [];

  return [
    {
      arrival_date: date,
      state: text("state") || "Maharashtra",
      district: text("district"),
      market,
      commodity,
      variety: text("variety"),
      grade: text("grade"),
      min_price: num("min_price"),
      max_price: num("max_price"),
      modal_price: modal,
      source,
      fetched_at: new Date().toISOString(),
    },
  ];
}

function parseDate(value: string): string | null {
  let m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = value.match(/^(\d{4})-(\d{2})-(\d{2})/); // yyyy-mm-dd or ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
