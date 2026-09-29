import { LogoMark } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getT();
  return (
    <footer className="mt-auto border-t border-line bg-canvas pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-muted md:flex-row">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-semibold text-ink">
            {t("common.appName")} © {new Date().getFullYear()} · {t("common.company")}
          </span>
        </div>
        <span>{t("common.dataSource")}</span>
      </div>
    </footer>
  );
}
