import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocale, type Locale } from "@/lib/i18n/config";

export type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  language: Locale;
  district: string;
  preferred_market: string | null;
  onboarded: boolean;
  trial_ends_at: string;
  plan: "free" | "paid";
};

/** The signed-in user's profile, or null. Uses the user's own session (RLS applies). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, phone, name, language, district, preferred_market, onboarded, trial_ends_at, plan")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { ...data, language: isLocale(data.language) ? data.language : "en" } as Profile;
}

/** For pages: signed in and onboarded, otherwise redirect. */
export async function requireProfile(opts: { allowNotOnboarded?: boolean } = {}): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarded && !opts.allowNotOnboarded) redirect("/onboarding");
  return profile;
}
