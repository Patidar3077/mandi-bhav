import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { todayIST } from "@/lib/format";
import type { Profile } from "@/lib/auth";

// PRD 4.2
export const FREE_LIMITS = { search: 5, chat: 10 };
// Hidden fair-use caps during the trial (and for paid plans later).
export const FAIR_USE_LIMITS = { search: 100, chat: 200 };

export type LimitDenied = { ok: false; reason: "search" | "chat" | "fairUse"; limit: number };
export type LimitResult = { ok: true } | LimitDenied;

export function trialInfo(profile: Pick<Profile, "trial_ends_at" | "plan">) {
  const msLeft = Date.parse(profile.trial_ends_at) - Date.now();
  const inTrial = msLeft > 0;
  return { inTrial, daysLeft: inTrial ? Math.ceil(msLeft / 86_400_000) : 0, paid: profile.plan === "paid" };
}

function limitsFor(profile: Profile) {
  const { inTrial, paid } = trialInfo(profile);
  const generous = inTrial || paid;
  return { generous, limits: generous ? FAIR_USE_LIMITS : FREE_LIMITS };
}

async function consume(userId: string, kind: "search" | "chat", limit: number) {
  const { data, error } = await adminClient().rpc("consume_usage", { p_user: userId, p_kind: kind, p_limit: limit });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean } | undefined;
  return Boolean(row?.allowed);
}

/**
 * Counts one "search" (Check Market Price / Analyze Market on a new crop + district).
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

  const { generous, limits } = limitsFor(profile);
  if (!(await consume(profile.id, "search", limits.search))) {
    return { ok: false, reason: generous ? "fairUse" : "search", limit: limits.search };
  }
  await db.from("searches").insert({ user_id: profile.id, commodity, district, market, search_date: today });
  return { ok: true };
}

export async function consumeChatMessage(profile: Profile): Promise<LimitResult> {
  const { generous, limits } = limitsFor(profile);
  if (!(await consume(profile.id, "chat", limits.chat))) {
    return { ok: false, reason: generous ? "fairUse" : "chat", limit: limits.chat };
  }
  return { ok: true };
}

export async function recentSearches(userId: string, limit = 5): Promise<string[]> {
  const { data } = await adminClient()
    .from("searches")
    .select("commodity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return [...new Set((data ?? []).map((r) => r.commodity as string))].slice(0, limit);
}
