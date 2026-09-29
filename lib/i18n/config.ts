import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import mr from "@/messages/mr.json";

export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];
export type Messages = typeof en;

export const DEFAULT_LOCALE: Locale = "en";
export const LANG_COOKIE = "lang";

export const LOCALE_LABELS: Record<Locale, string> = { en: "EN", hi: "हिं", mr: "मरा" };
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };

export const MESSAGES: Record<Locale, Messages> = { en, hi, mr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Looks up "section.key" in the dictionary (falling back to English) and fills {placeholders}. */
export function makeT(locale: Locale): TFunction {
  const dict = MESSAGES[locale];
  return (key, vars) => {
    const template = lookup(dict, key) ?? lookup(MESSAGES.en, key) ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      vars[name] === undefined ? `{${name}}` : String(vars[name]),
    );
  };
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}
