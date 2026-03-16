"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/lib/actions/auth.actions";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(resetPassword, null);

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
          {t("title")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
          {t("subtitle")}
        </p>
      </div>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {state?.error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: 10,
              color: "var(--danger)",
              fontSize: 14,
            }}
          >
            {state.error}
          </div>
        )}

        {state?.success && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(16, 185, 129, 0.1)",
              borderRadius: 10,
              color: "var(--success)",
              fontSize: 14,
            }}
          >
            {t("success")}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--text-primary)" }}
          >
            {tCommon("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 15,
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
          style={{ width: "100%", padding: "14px", justifyContent: "center" }}
        >
          {isPending ? t("submitting") : t("submit")}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-secondary)" }}>
        <Link href="/login" style={{ color: "var(--brand)", textDecoration: "none" }}>
          {t("backToLogin")}
        </Link>
      </p>
    </>
  );
}
