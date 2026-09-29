import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { listCommodities } from "@/lib/prices";
import { getPlaceOptions } from "@/lib/districts";
import { recentSearches } from "@/lib/limits";
import { MarketClient } from "./MarketClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.rates") };
}

export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const profile = await requireProfile();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const [commodities, places, recent] = await Promise.all([listCommodities(), getPlaceOptions(), recentSearches(profile.id)]);

  const districts = places.districts.includes(profile.district) ? places.districts : [profile.district, ...places.districts];

  return (
    <MarketClient
      commodities={commodities}
      districts={districts}
      markets={places.markets}
      neighbours={places.neighbours}
      recent={recent}
      initial={{
        crop: one(params.crop),
        district: one(params.district) || profile.district,
        market: one(params.market) || (one(params.district) ? "" : profile.preferred_market ?? ""),
      }}
    />
  );
}
