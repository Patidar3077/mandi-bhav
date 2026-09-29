"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { useChat } from "@/components/chat/ChatProvider";

export function NavLinks({ trendsHref }: { trendsHref: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { setOpen } = useChat();
  const base = "whitespace-nowrap rounded-lg px-4 py-2 text-[15px] transition-colors";
  const idle = `${base} text-muted hover:bg-sand hover:text-ink`;
  const active = `${base} bg-leaf text-card font-semibold`;

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      <Link href="/market" className={pathname.startsWith("/market") ? active : idle}>
        {t("nav.rates")}
      </Link>
      <Link href={trendsHref} className={pathname.startsWith("/analysis") ? active : idle}>
        {t("nav.trends")}
      </Link>
      <button type="button" onClick={() => setOpen(true)} className={idle}>
        {t("nav.advisor")}
      </button>
    </nav>
  );
}
