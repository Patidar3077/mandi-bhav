import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";
import { Icon } from "@/components/Icon";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getPlaceOptions } from "@/lib/districts";
import { trialInfo } from "@/lib/limits";
import { signOut } from "@/app/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.title") };
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [{ t }, places] = await Promise.all([getT(), getPlaceOptions()]);
  const trial = trialInfo(profile);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <section className="card p-5 sm:p-6">
        <h1 className="text-[22px] font-bold leading-[30px] text-leaf-deep">{t("profile.title")}</h1>
        <p className="mb-1 mt-1 text-[15px] text-muted">{t("profile.email", { email: profile.email ?? profile.phone ?? "" })}</p>
        <p className="mb-5 text-sm font-semibold text-leaf">
          {trial.inTrial ? t("common.trialDaysLeft", { n: trial.daysLeft }) : `${t("common.freePlan")} · ${t("common.paidSoon")}`}
        </p>
        <ProfileForm
          mode="profile"
          initial={{
            name: profile.name ?? "",
            language: profile.language,
            district: profile.district,
            preferredMarket: profile.preferred_market ?? "",
          }}
          {...places}
        />
      </section>
      <form action={signOut}>
        <button type="submit" className="btn-secondary w-full">
          <Icon name="logout" className="text-[20px]" /> {t("common.signOut")}
        </button>
      </form>
    </div>
  );
}
