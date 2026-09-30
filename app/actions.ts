"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { readVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, visitorCookieValue } from "@/lib/auth";
import { isLocale, LANG_COOKIE } from "@/lib/i18n/config";

const YEAR = 60 * 60 * 24 * 365;
// Stops scripts from creating endless visitors (to dodge the fair-use caps) from one network.
const NEW_VISITORS_PER_IP_PER_DAY = 30;

async function currentVisitorId() {
  return readVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
}

export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const id = await currentVisitorId();
  if (id) await adminClient().from("visitors").update({ language: locale }).eq("id", id);
}

export type SaveProfileState = { ok: boolean; error?: "invalid" | "busy" | "failed" };

/** Welcome and profile form: name + district (+ optional mandi and language). No login needed. */
export async function saveProfile(_prev: SaveProfileState, form: FormData): Promise<SaveProfileState> {
  const language = String(form.get("language") ?? "en");
  const district = String(form.get("district") ?? "").trim();
  const market = String(form.get("preferred_market") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!isLocale(language) || !district || !name) return { ok: false, error: "invalid" };

  const db = adminClient();
  const jar = await cookies();
  const fields = { name, language, district, preferred_market: market || null, last_seen_at: new Date().toISOString() };
  const existingId = await currentVisitorId();

  let saved = false;
  if (existingId) {
    const { data } = await db.from("visitors").update(fields).eq("id", existingId).select("id");
    saved = Boolean(data?.length);
  }
  if (!saved) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    if (ip) {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await db.from("visitors").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since);
      if ((count ?? 0) >= NEW_VISITORS_PER_IP_PER_DAY) return { ok: false, error: "busy" };
    }
    const { data, error } = await db.from("visitors").insert({ ...fields, ip }).select("id").single();
    if (error || !data) return { ok: false, error: "failed" };
    jar.set(VISITOR_COOKIE, visitorCookieValue(data.id), {
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  jar.set(LANG_COOKIE, language, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (form.get("redirect") === "market") redirect("/market");
  return { ok: true };
}

/** "Use as a different person": forget this device's visitor. */
export async function forgetMe() {
  (await cookies()).delete(VISITOR_COOKIE);
  redirect("/welcome");
}
