"use client";

import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import type { AdminUserListItemDTO } from "@/lib/dtos/user-admin.dto";
import { adminDeleteUser, adminUpdateUser } from "@/lib/actions/user.admin.actions";
import styles from "./UserDetailClient.module.css";

const fontUi = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-user-detail-ui",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-user-detail-mono",
  display: "swap",
});

function formatDt(d: Date | string | null | undefined, intlLocale: string) {
  if (d == null) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(intlLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapActionError(
  err: { error: string; code?: string },
  t: (key: string, values?: Record<string, string>) => string
) {
  if (err.error === "UNAUTHORIZED") return t("errorUnauthorized");
  if (err.code === "LAST_ADMIN") return t("errorLastAdmin");
  if (err.code === "SELF_ACTION") return t("errorSelfAction");
  return t("errorGeneric", { message: err.error });
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 16l3-8 4 5 4-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10.5 10.5L18 18M14 14l2 2M16 12l2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

type Props = {
  user: AdminUserListItemDTO;
};

export default function UserDetailClient({ user }: Props) {
  const t = useTranslations("admin.users");
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-US" : "zh-CN";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [role, setRole] = useState<"user" | "admin">(user.role);
  const [isDisabled, setIsDisabled] = useState(user.isDisabled);

  const headlineEmail = user.email?.trim() || "—";
  const initial =
    headlineEmail && headlineEmail !== "—"
      ? headlineEmail.trim().charAt(0).toUpperCase()
      : "?";

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copyUserId = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(user.id);
        setIdCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setIdCopied(false), 2000);
      } catch {
        /* ignore */
      }
    })();
  };

  const save = () => {
    startTransition(async () => {
      const result = await adminUpdateUser(user.id, {
        fullName: fullName.trim() || null,
        role,
        isDisabled,
      });
      if (result.success) {
        router.refresh();
        if (savedTimer.current) clearTimeout(savedTimer.current);
        setSavedFlash(true);
        savedTimer.current = setTimeout(() => setSavedFlash(false), 2200);
      } else {
        alert(mapActionError(result, t));
      }
    });
  };

  const del = () => {
    if (!confirm(t("confirmDelete"))) return;
    setIsDeleting(true);
    void (async () => {
      try {
        const result = await adminDeleteUser(user.id, locale);
        if (result.success) {
          router.replace("/admin/users");
          return;
        }
        alert(mapActionError(result, t));
      } finally {
        setIsDeleting(false);
      }
    })();
  };

  return (
    <div className={`${styles.shell} ${fontUi.variable} ${fontMono.variable}`}>
      <Link href="/admin/users" className={styles.backLink}>
        ← {t("backToList")}
      </Link>

      <div className={styles.grid}>
        <aside className={styles.identity} aria-label={t("detailTitle")}>
          <div className={styles.identityInner}>
            <div className={styles.avatar} aria-hidden>
              {initial}
            </div>
            <p className={styles.eyebrow}>{t("detailEyebrow")}</p>
            <h1 className={styles.headline}>{headlineEmail}</h1>

            <div className={styles.idBlock}>
              <div className={styles.idLabel}>{t("fieldUserId")}</div>
              <div className={styles.idRow}>
                <p className={styles.monoId}>{user.id}</p>
                <button
                  type="button"
                  className={`${styles.copyBtn} ${idCopied ? styles.copyBtnCopied : ""}`}
                  onClick={copyUserId}
                >
                  {idCopied ? t("copied") : t("copyUserId")}
                </button>
              </div>
            </div>

            <div className={styles.pillRow} aria-live="polite">
              <span className={`${styles.pill} ${role === "admin" ? styles.pillAdmin : styles.pillUser}`}>
                {role === "admin" ? t("roleAdmin") : t("roleUser")}
              </span>
              {isDisabled && <span className={`${styles.pill} ${styles.pillDisabled}`}>{t("disabledYes")}</span>}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          <div className={styles.bento}>
            <div className={styles.bentoCard}>
              <div className={styles.bentoIcon}>
                <IconActivity />
              </div>
              <div className={styles.bentoLabel}>{t("fieldLastSignIn")}</div>
              <div className={styles.bentoValue}>{formatDt(user.lastSignInAt, intlLocale)}</div>
            </div>
            <div className={styles.bentoCard}>
              <div className={styles.bentoIcon}>
                <IconKey />
              </div>
              <div className={styles.bentoLabel}>{t("fieldAuthCreated")}</div>
              <div className={styles.bentoValue}>{formatDt(user.authCreatedAt, intlLocale)}</div>
            </div>
            <div className={styles.bentoCard}>
              <div className={styles.bentoIcon}>
                <IconCard />
              </div>
              <div className={styles.bentoLabel}>{t("fieldProfileCreated")}</div>
              <div className={styles.bentoValue}>{formatDt(user.profileCreatedAt, intlLocale)}</div>
            </div>
          </div>

          <section className={styles.formCard} aria-labelledby="section-access">
            <h2 id="section-access" className={styles.sectionTitle}>
              {t("sectionAccess")}
            </h2>

            <div className={styles.field}>
              <label htmlFor="fullName" className={styles.label}>
                {t("fieldFullName")}
              </label>
              <input
                id="fullName"
                className={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="role" className={styles.label}>
                {t("fieldRole")}
              </label>
              <select
                id="role"
                className={styles.select}
                value={role}
                onChange={(e) => setRole(e.target.value as "user" | "admin")}
              >
                <option value="user">{t("roleUser")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </select>
            </div>

            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={isDisabled}
                onChange={(e) => setIsDisabled(e.target.checked)}
              />
              <span className={styles.toggleText}>
                <span className={styles.toggleTitle}>{t("fieldDisabled")}</span>
                <span className={styles.toggleHint}>{t("fieldDisabledHint")}</span>
              </span>
            </label>
          </section>

          <div className={styles.actionDock}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={save}
              disabled={isPending || isDeleting}
            >
              {isPending && !isDeleting ? t("savePending") : t("save")}
            </button>
            {savedFlash && <span className={styles.savedToast}>{t("savedToast")}</span>}
            <button
              type="button"
              className={styles.btnDanger}
              onClick={del}
              disabled={isPending || isDeleting}
            >
              {isDeleting ? t("deleting") : t("delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
