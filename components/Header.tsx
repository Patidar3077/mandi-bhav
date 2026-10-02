import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { NavLinks } from "@/components/NavLinks";
import { getT } from "@/lib/i18n/server";
import type { Profile } from "@/lib/auth";

export async function Header({ profile, trendsHref }: { profile: Profile | null; trendsHref: string }) {
  const { t } = await getT();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 shadow-card backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20">
        <Link href={profile ? "/market" : "/welcome"} className="flex min-w-0 shrink-0 items-center gap-2">
          <LogoMark className="h-10 w-10 shrink-0" />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="text-lg font-semibold leading-6 tracking-tight text-leaf-deep">{t("common.appName")}</span>
            <span className="truncate text-[11px] font-medium text-brown">{t("common.tagline")}</span>
          </div>
        </Link>

        {profile && <NavLinks trendsHref={trendsHref} />}

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitch />
          {profile && (
            <Link
              href="/profile"
              aria-label={t("nav.profile")}
              title={t("profile.hello", { name: profile.name })}
              className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-leaf-deep px-2 text-card"
            >
              <Icon name="person" className="text-[20px]" />
              <span className="hidden max-w-28 truncate pr-1 text-sm font-semibold md:inline">{profile.name}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
