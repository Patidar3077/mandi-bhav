import type { Locale } from "./i18n/config";

// Latin digits in every language so prices line up and stay easy to compare.
const intlLocale = (locale: Locale) => `${locale === "en" ? "en" : locale}-IN-u-nu-latn`;

/** ₹1,25,000 style Indian formatting. Prices are stored per quintal. */
export function formatINR(value: number | null | undefined, locale: Locale = "en", decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Per-quintal price shown per kg (1 quintal = 100 kg). */
export function formatPerKg(perQuintal: number | null | undefined, locale: Locale = "en") {
  if (perQuintal === null || perQuintal === undefined) return "—";
  return formatINR(perQuintal / 100, locale, 2);
}

export function formatPct(value: number | null | undefined, locale: Locale = "en") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(Math.abs(value))}%`;
}

export function formatSignedINR(value: number | null | undefined, locale: Locale = "en") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatINR(Math.abs(value), locale)}`;
}

/** "29 Sep 2026" from an ISO date (YYYY-MM-DD). */
export function formatDate(isoDate: string, locale: Locale = "en", withYear = true) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Today's date in India (IST) as YYYY-MM-DD. */
export function todayIST(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
