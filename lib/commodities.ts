import type { Locale } from "./i18n/config";

export type Commodity = {
  data_name: string;
  name_en: string;
  name_hi: string | null;
  name_mr: string | null;
  aliases: string[];
  is_quick_pick: boolean;
};

export function commodityLabel(c: Pick<Commodity, "name_en" | "name_hi" | "name_mr">, locale: Locale) {
  if (locale === "hi" && c.name_hi) return c.name_hi;
  if (locale === "mr" && c.name_mr) return c.name_mr;
  return c.name_en;
}

/** Commodities that only exist in the price data (not in the table yet) still show, in English. */
export function fallbackCommodity(dataName: string): Commodity {
  return { data_name: dataName, name_en: dataName, name_hi: null, name_mr: null, aliases: [], is_quick_pick: false };
}

const normalise = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function names(c: Commodity) {
  return [c.data_name, c.name_en, c.name_hi ?? "", c.name_mr ?? "", ...c.aliases].map(normalise).filter(Boolean);
}

/** Score how well a query matches a commodity (lower is better, Infinity = no match). */
function score(c: Commodity, query: string) {
  let best = Infinity;
  for (const name of names(c)) {
    if (name === query) return 0;
    if (name.startsWith(query)) best = Math.min(best, 1);
    else if (name.split(" ").some((w) => w.startsWith(query))) best = Math.min(best, 2);
    else if (name.includes(query)) best = Math.min(best, 3);
    else if (query.length >= 4) {
      const allowed = query.length >= 7 ? 2 : 1;
      const d = Math.min(
        editDistance(query, name),
        ...name.split(" ").map((w) => editDistance(query, w)),
        editDistance(query, name.slice(0, query.length)),
      );
      if (d <= allowed) best = Math.min(best, 4 + d);
    }
  }
  return best;
}

export function searchCommodities(list: Commodity[], query: string, limit = 8) {
  const q = normalise(query);
  if (!q) return [];
  return list
    .map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s || a.c.name_en.localeCompare(b.c.name_en))
    .slice(0, limit)
    .map((x) => x.c);
}

/** Best single match for free text (used by the chatbot tools). */
export function resolveCommodity(list: Commodity[], text: string): Commodity | null {
  return searchCommodities(list, text, 1)[0] ?? null;
}
