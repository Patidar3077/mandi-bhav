import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Icon } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { t } = await getT();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <LogoMark className="h-10 w-10" />
          <span className="text-lg font-semibold text-leaf-deep">{t("common.appName")}</span>
        </div>
        <LanguageSwitch />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 pb-10 md:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h1 className="text-[28px] font-bold leading-9 text-leaf-deep md:text-4xl md:leading-[44px]">{t("common.tagline")}</h1>
          <p className="text-[17px] leading-[26px] text-muted">{t("login.subtitle")}</p>
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
          <h2 className="mb-4 text-xl font-semibold text-leaf-deep">{t("login.title")}</h2>
          {error && <p className="mb-3 rounded-lg bg-down-bg p-3 text-sm text-down">{t("login.invalidCode")}</p>}
          <LoginForm />
          <p className="mt-4 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="info" className="text-[16px]" /> {t("login.phoneSoon")}
          </p>
        </section>
      </main>
    </div>
  );
}
