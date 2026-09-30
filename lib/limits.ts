import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { todayIST } from "@/lib/format";
import type { Profile } from "@/lib/auth";

/**
 * The app is free for everyone. These hidden per-device caps only stop abuse and runaway
 * Apify / AI costs; a real farmer never sees them.
 */
export const FAIR_USE_LIMITS = { search: 100, chat: 200 };

export type LimitDenied = { ok: false; reason: "fairUse"; limit: number };
export type LimitResult = { ok: true } | LimitDenied;

async function consume(visitorId: string, kind: "search" | "chat", limit: number) {
  const { data, error } = await adminClient().rpc("consume_usage", { p_user: visitorId, p_kind: kind, p_limit: limit });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean } | undefined;
  return Boolean(row?.allowed);
}

/**
 * Records one search (Check Market Price / Analyze Market on a new crop + district).
 * Reopening the same crop + district the same day doesn't count again.
 */
export async function consumeSearch(profile: Profile, commodity: string, district: string, market: string | null): Promise<LimitResult> {
  const db = adminClient();
  const today = todayIST();
  const { data: existing } = await db
    .from("searches")
    .select("id")
    .eq("user_id", profile.id)
    .eq("commodity", commodity)
    .eq("district", district)
    .eq("search_date", today)
    .limit(1);
  if (existing?.length) return { ok: true };

  if (!(await consume(profile.id, "search", FAIR_USE_LIMITS.search))) {
    return { ok: false, reason: "fairUse", limit: FAIR_USE_LIMITS.search };
  }
  await db.from("searches").insert({ user_id: profile.id, commodity, district, market, search_date: today });
  return { ok: true };
}

export async function consumeChatMessage(profile: Profile): Promise<LimitResult> {
  if (!(await consume(profile.id, "chat", FAIR_USE_LIMITS.chat))) {
    return { ok: false, reason: "fairUse", limit: FAIR_USE_LIMITS.chat };
  }
  return { ok: true };
}

export async function recentSearches(visitorId: string, limit = 5): Promise<string[]> {
  const { data } = await adminClient()
    .from("searches")
    .select("commodity, created_at")
    .eq("user_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(30);
  return [...new Set((data ?? []).map((r) => r.commodity as string))].slice(0, limit);
}
