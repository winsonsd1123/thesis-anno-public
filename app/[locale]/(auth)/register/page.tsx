"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { signUp, signInWithOAuth } from "@/lib/actions/auth.actions";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(signUp, null);

  async function handleOAuth(provider: "google" | "github") {
    const { redirectUrl } = await signInWithOAuth(provider);
    if (redirectUrl) window.location.href = redirectUrl;
  }

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

        <div>
          <label
            htmlFor="password"
            style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--text-primary)" }}
          >
            {tCommon("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
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

        <div>
          <label
            htmlFor="fullName"
            style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--text-primary)" }}
          >
            {t("nickname")}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder={t("nicknamePlaceholder")}
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

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("github")}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          GitHub
        </button>
      </div>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-secondary)" }}>
        {t("hasAccount")}{" "}
        <Link href="/login" style={{ color: "var(--brand)", textDecoration: "none" }}>
          {t("loginNow")}
        </Link>
      </p>
    </>
  );
}
