"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LANG_COOKIE } from "@/lib/i18n/config";

const YEAR = 60 * 60 * 24 * 365;

export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ language: locale }).eq("id", user.id);
}

export type SaveProfileState = { ok: boolean; error?: string };

/** Onboarding and profile form. Users can only change these columns (see the RLS column grants). */
export async function saveProfile(_prev: SaveProfileState, form: FormData): Promise<SaveProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const language = String(form.get("language") ?? "en");
  const district = String(form.get("district") ?? "").trim();
  const market = String(form.get("preferred_market") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!isLocale(language) || !district) return { ok: false, error: "invalid" };

  const { error } = await supabase
    .from("profiles")
    .update({ name: name || null, language, district, preferred_market: market || null, onboarded: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  (await cookies()).set(LANG_COOKIE, language, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (form.get("redirect") === "market") redirect("/market");
  return { ok: true };
}

/** After sign-in on a new device, returning users get their saved language back. */
export async function afterSignIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from("profiles").select("language, onboarded").eq("id", user.id).maybeSingle();
  if (data?.onboarded && isLocale(data.language)) {
    (await cookies()).set(LANG_COOKIE, data.language, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
