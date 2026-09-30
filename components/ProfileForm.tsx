"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProfile, type SaveProfileState } from "@/app/actions";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  initial: { name: string; language: Locale; district: string; preferredMarket: string };
  districts: string[];
  markets: { market: string; district: string }[];
  neighbours: Record<string, string[]>;
  mode: "welcome" | "profile";
};

export function ProfileForm({ initial, districts, markets, neighbours, mode }: Props) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(saveProfile, { ok: false });
  const [district, setDistrict] = useState(initial.district);

  const nearbyMarkets = useMemo(() => {
    const allowed = new Set([district, ...(neighbours[district] ?? [])]);
    return markets.filter((m) => allowed.has(m.district));
  }, [district, markets, neighbours]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {mode === "welcome" && <input type="hidden" name="redirect" value="market" />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("onboarding.nameLabel")}</span>
        <input name="name" defaultValue={initial.name} maxLength={80} autoComplete="name" required placeholder={t("onboarding.namePlaceholder")} className="field" />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">{t("onboarding.languageLabel")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {LOCALES.map((l) => (
            <label
              key={l}
              lang={l}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-line bg-card px-2 font-semibold has-[:checked]:border-leaf has-[:checked]:bg-leaf has-[:checked]:text-card"
            >
              <input type="radio" name="language" value={l} defaultChecked={initial.language === l} className="sr-only" />
              {LOCALE_NAMES[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("onboarding.districtLabel")}</span>
        <select name="district" value={district} onChange={(e) => setDistrict(e.target.value)} className="field">
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("onboarding.marketLabel")}</span>
        <select name="preferred_market" defaultValue={initial.preferredMarket} key={district} className="field">
          <option value="">{t("onboarding.marketNone")}</option>
          {nearbyMarkets.map((m) => (
            <option key={`${m.market}|${m.district}`} value={m.market}>
              {m.market} ({m.district})
            </option>
          ))}
        </select>
        <span className="text-[13px] text-muted">{t("onboarding.marketHint")}</span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-down-bg p-3 text-sm text-down">
          {state.error === "invalid" ? t("welcome.nameRequired") : state.error === "busy" ? t("welcome.busy") : t("common.error")}
        </p>
      )}
      {state.ok && mode === "profile" && (
        <p role="status" className="rounded-lg bg-up-bg p-3 text-sm text-leaf">
          {t("profile.saved")}
        </p>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
        {mode === "welcome" ? t("welcome.start") : t("common.save")}
      </button>
    </form>
  );
}
