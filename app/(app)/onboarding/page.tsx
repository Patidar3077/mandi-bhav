import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getPlaceOptions } from "@/lib/districts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("onboarding.title") };
}

export default async function OnboardingPage() {
  const profile = await requireProfile({ allowNotOnboarded: true });
  if (profile.onboarded) redirect("/market");
  const [{ t, locale }, places] = await Promise.all([getT(), getPlaceOptions()]);

  return (
    <div className="mx-auto max-w-xl">
      <section className="card p-5 sm:p-6">
        <h1 className="text-[22px] font-bold leading-[30px] text-leaf-deep">{t("onboarding.title")}</h1>
        <p className="mb-5 mt-1 text-[15px] text-muted">{t("onboarding.subtitle")}</p>
        <ProfileForm
          mode="onboarding"
          initial={{ name: profile.name ?? "", language: locale, district: profile.district, preferredMarket: "" }}
          {...places}
        />
      </section>
    </div>
  );
}
