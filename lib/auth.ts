import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n/config";

/** No login: a visitor is remembered on their device by a signed cookie holding their visitor id. */
export const VISITOR_COOKIE = "mb_visitor";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

export type Profile = {
  id: string;
  name: string;
  language: Locale;
  district: string;
  preferred_market: string | null;
};

function sign(id: string) {
  return createHmac("sha256", serverEnv.visitorCookieSecret()).update(id).digest("base64url");
}

export function visitorCookieValue(id: string) {
  return `${id}.${sign(id)}`;
}

/** The visitor id from a cookie value, or null if it's missing or tampered with. */
export function readVisitorId(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export async function getProfile(): Promise<Profile | null> {
  const id = readVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
  if (!id) return null;
  const { data } = await adminClient()
    .from("visitors")
    .select("id, name, language, district, preferred_market")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...data, language: isLocale(data.language) ? data.language : "en" };
}

/** For pages: the current visitor, or send them to the welcome screen. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/welcome");
  return profile;
}
