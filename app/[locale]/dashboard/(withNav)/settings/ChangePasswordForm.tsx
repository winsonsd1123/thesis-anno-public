"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { changePasswordInSettings } from "@/lib/actions/auth.actions";
import { Link } from "@/i18n/navigation";
import formStyles from "./SettingsForms.module.css";

function EyeOpen() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw || pw.length < 4) return 0;
  if (pw.length < 8) return 1;
  let types = 0;
  if (/[A-Z]/.test(pw)) types++;
  if (/[a-z]/.test(pw)) types++;
  if (/[0-9]/.test(pw)) types++;
  if (/[^A-Za-z0-9]/.test(pw)) types++;
  if (types <= 2) return 1;
  if (types === 3) return 2;
  return 3;
}

export function ChangePasswordForm() {
  const t = useTranslations("dashboard.changePasswordForm");
  const [state, formAction, isPending] = useActionState(changePasswordInSettings, null);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPw, setNewPw] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setNewPw("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [state]);

  const strength = getStrength(newPw);
  const strengthColorClass =
    strength === 1 ? formStyles.strengthWeak
    : strength === 2 ? formStyles.strengthMedium
    : formStyles.strengthStrong;
  const strengthLabel =
    strength === 1 ? t("strengthWeak")
    : strength === 2 ? t("strengthMedium")
    : strength === 3 ? t("strengthStrong")
    : "";

  return (
    <form ref={formRef} action={formAction} className={`${formStyles.card} ${formStyles.cardSecurity}`}>
      {state?.error && (
        <div className={`${formStyles.message} ${formStyles.messageError}`} role="alert">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className={`${formStyles.message} ${formStyles.messageSuccess}`} role="status">
          {t("success")}
        </div>
      )}

      <div className={formStyles.cardHead}>
        <h2 className={formStyles.cardTitle}>{t("sectionTitle")}</h2>
        <p className={formStyles.cardSubtitle}>{t("sectionSubtitle")}</p>
      </div>

      {/* 当前密码 */}
      <section className={formStyles.section}>
        <label className={formStyles.label} htmlFor="currentPassword">
          {t("currentPasswordLabel")}
        </label>
        <div className={formStyles.passwordWrapper}>
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${formStyles.input} ${formStyles.inputWithToggle}`}
          />
          <button
            type="button"
            className={formStyles.passwordToggle}
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? t("hidePassword") : t("showPassword")}
          >
            {showCurrent ? <EyeClosed /> : <EyeOpen />}
          </button>
        </div>
        <Link href="/forgot-password" className={formStyles.forgotLink}>
          {t("forgotPasswordLink")}
        </Link>
      </section>

      {/* 新密码 + 强度 */}
      <section className={`${formStyles.section} ${formStyles.fieldGap}`}>
        <label className={formStyles.label} htmlFor="newPassword">
          {t("newPasswordLabel")}
        </label>
        <div className={formStyles.passwordWrapper}>
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder={t("newPasswordPlaceholder")}
            className={`${formStyles.input} ${formStyles.inputWithToggle}`}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <button
            type="button"
            className={formStyles.passwordToggle}
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? t("hidePassword") : t("showPassword")}
          >
            {showNew ? <EyeClosed /> : <EyeOpen />}
          </button>
        </div>
        {newPw && (
          <div className={formStyles.strengthRow}>
            <div className={formStyles.strengthBar}>
              {[1, 2, 3].map((lvl) => (
                <span
                  key={lvl}
                  className={`${formStyles.strengthSegment} ${strength >= lvl ? strengthColorClass : ""}`}
                />
              ))}
            </div>
            {strengthLabel && (
              <span className={`${formStyles.strengthLabel} ${strengthColorClass}`}>
                {strengthLabel}
              </span>
            )}
          </div>
        )}
      </section>

      {/* 确认新密码 */}
      <section className={`${formStyles.section} ${formStyles.fieldGap}`}>
        <label className={formStyles.label} htmlFor="confirmNewPassword">
          {t("confirmPasswordLabel")}
        </label>
        <div className={formStyles.passwordWrapper}>
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder={t("confirmPasswordPlaceholder")}
            className={`${formStyles.input} ${formStyles.inputWithToggle}`}
          />
          <button
            type="button"
            className={formStyles.passwordToggle}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
          >
            {showConfirm ? <EyeClosed /> : <EyeOpen />}
          </button>
        </div>
      </section>

      <div className={formStyles.actions}>
        <button type="submit" disabled={isPending} className={`btn-primary ${formStyles.submit}`}>
          {isPending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
