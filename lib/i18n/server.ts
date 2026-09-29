import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, makeT, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
