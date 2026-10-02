import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Icon } from "@/components/Icon";
import { ProfileForm } from "@/components/ProfileForm";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getPlaceOptions } from "@/lib/districts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.title") };
}

/** First screen: name + district, then straight into the app. No sign-up or login. */
export default async function WelcomePage() {
  if (await getProfile()) redirect("/market");
  const [{ t, locale }, places] = await Promise.all([getT(), getPlaceOptions()]);
  const districts = places.districts.includes("Mumbai") ? places.districts : ["Mumbai", ...places.districts];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <LogoMark className="h-10 w-10" />
          <span className="text-lg font-semibold text-leaf-deep">{t("common.appName")}</span>
        </div>
        <LanguageSwitch />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-4 pb-10 md:grid-cols-2 md:items-center">
        <section className="flex flex-col gap-4">
          <h1 className="text-[28px] font-bold leading-9 text-leaf-deep md:text-4xl md:leading-[44px]">{t("common.tagline")}</h1>
          <p className="text-[17px] leading-[26px] text-muted">{t("welcome.subtitle")}</p>
          <ul className="flex flex-col gap-2 text-[15px]">
            {[
              ["storefront", t("nav.rates")],
              ["auto_graph", t("analysis.forecastTitle")],
              ["smart_toy", t("chat.title")],
            ].map(([icon, label]) => (
              <li key={icon} className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
                  <Icon name={icon} className="text-[18px]" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-leaf-deep">{t("welcome.title")}</h2>
          <ProfileForm
            mode="welcome"
            initial={{ name: "", language: locale, district: "Mumbai", preferredMarket: "" }}
            {...places}
            districts={districts}
          />
          <p className="mt-4 flex items-start gap-1.5 text-[13px] leading-[18px] text-muted">
            <Icon name="info" className="shrink-0 text-[16px]" /> {t("welcome.privacy")}
          </p>
        </section>
      </main>
      <footer className="px-4 pb-6 text-center text-[13px] text-muted">
        {t("common.appName")} · {t("common.company")} · {t("common.notGov")}
      </footer>
    </div>
  );
}
