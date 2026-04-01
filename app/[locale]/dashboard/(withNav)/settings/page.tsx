import { Outfit } from "next/font/google";
import { getProfile } from "@/lib/actions/profile.actions";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import styles from "./SettingsPage.module.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-settings-display",
  display: "swap",
});

export default async function SettingsPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const canChangePassword =
    authData.user?.identities?.some((i) => i.provider === "email") ?? false;
  const t = await getTranslations("dashboard");

  return (
    <div className={`${styles.shell} ${outfit.variable}`}>
      <div className={`grid-bg ${styles.gridLayer}`} aria-hidden />
      <div className={styles.glowPrimary} aria-hidden />
      <div className={styles.glowSecondary} aria-hidden />

      <div className={styles.shellInner}>
        <header className={styles.header}>
          <p className={styles.kicker}>
            <span className={styles.kickerDot} aria-hidden />
            {t("settingsLayout.kicker")}
          </p>
          <h1 className={styles.title}>{t("personalSettings")}</h1>
          <p className={styles.subtitle}>{t("settingsSubtitle")}</p>
        </header>

        <div className={styles.cardStack}>
          <div className={styles.stagger1}>
            <ProfileForm profile={profile} />
          </div>
          {canChangePassword ? (
            <div className={styles.stagger2}>
              <ChangePasswordForm />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
