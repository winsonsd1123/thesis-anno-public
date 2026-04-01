"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/profile.actions";
import { AvatarUpload } from "@/app/components/profile/AvatarUpload";
import type { UserProfileDTO } from "@/lib/dtos/user.dto";
import formStyles from "./SettingsForms.module.css";

export function ProfileForm({ profile }: { profile: UserProfileDTO | null }) {
  const t = useTranslations("dashboard.profileForm");
  const tLayout = useTranslations("dashboard.settingsLayout");
  const [state, formAction, isPending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className={formStyles.card}>
      {state?.error && (
        <div className={`${formStyles.message} ${formStyles.messageError}`} role="alert">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className={`${formStyles.message} ${formStyles.messageSuccess}`} role="status">
          {t("saveSuccess")}
        </div>
      )}

      <div className={formStyles.cardHead}>
        <h2 className={formStyles.cardTitle}>{tLayout("profileCardTitle")}</h2>
        <p className={formStyles.cardSubtitle}>{tLayout("profileCardSubtitle")}</p>
      </div>

      <section className={formStyles.section}>
        <span className={`${formStyles.label} ${formStyles.labelTight}`}>{t("avatar")}</span>
        <AvatarUpload
          currentUrl={profile?.avatarUrl ?? null}
          displayName={profile?.fullName}
          onUrlChange={(url) => {
            const input = document.getElementById("avatarUrl") as HTMLInputElement;
            if (input) input.value = url;
          }}
        />
        <input
          id="avatarUrl"
          name="avatarUrl"
          type="hidden"
          defaultValue={profile?.avatarUrl ?? ""}
        />
      </section>

      <hr className={formStyles.divider} />

      <section className={formStyles.section}>
        <label className={formStyles.label} htmlFor="fullName">
          {t("nickname")}
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={profile?.fullName ?? ""}
          placeholder={t("nicknamePlaceholder")}
          className={formStyles.input}
        />
      </section>

      <div className={formStyles.actions}>
        <button type="submit" disabled={isPending} className={`btn-primary ${formStyles.submit}`}>
          {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
