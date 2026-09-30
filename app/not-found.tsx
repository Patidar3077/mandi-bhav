import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";

/** Friendly page for any address that doesn't exist. */
export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="h-14 w-14" />
      <h1 className="text-[22px] font-bold leading-[30px] text-leaf-deep">{t("notFound.title")}</h1>
      <p className="text-[15px] text-muted">{t("notFound.body")}</p>
      <Link href="/" className="btn-primary">
        <Icon name="storefront" className="text-[20px]" /> {t("notFound.home")}
      </Link>
    </main>
  );
}
