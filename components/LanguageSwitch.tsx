"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguage } from "@/app/actions";
import { LOCALES, LOCALE_LABELS, LOCALE_NAMES } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("login.languageLabel")}
      className={`flex items-center rounded-full border border-line bg-card p-0.5 shadow-card ${pending ? "opacity-60" : ""}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LOCALE_NAMES[l]}
          aria-pressed={l === locale}
          onClick={() =>
            start(async () => {
              await setLanguage(l);
              router.refresh();
            })
          }
          className={`min-h-9 min-w-10 rounded-full px-2.5 text-xs font-semibold transition-colors ${
            l === locale ? "bg-leaf text-card" : "text-muted hover:text-ink"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
