import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";
import { Icon } from "@/components/Icon";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getPlaceOptions } from "@/lib/districts";
import { forgetMe } from "@/app/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.title") };
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [{ t }, places] = await Promise.all([getT(), getPlaceOptions()]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <section className="card p-5 sm:p-6">
        <h1 className="text-[22px] font-bold leading-[30px] text-leaf-deep">{t("profile.hello", { name: profile.name })}</h1>
        <p className="mb-5 mt-1 text-[15px] text-muted">{t("profile.title")}</p>
        <ProfileForm
          mode="profile"
          initial={{
            name: profile.name,
            language: profile.language,
            district: profile.district,
            preferredMarket: profile.preferred_market ?? "",
          }}
          {...places}
        />
      </section>
      <form action={forgetMe} className="flex flex-col gap-1">
        <button type="submit" className="btn-secondary w-full">
          <Icon name="logout" className="text-[20px]" /> {t("profile.forget")}
        </button>
        <p className="text-center text-[13px] text-muted">{t("profile.forgetHint")}</p>
      </form>
    </div>
  );
}
