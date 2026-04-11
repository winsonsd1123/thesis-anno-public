"use client";

import { useActionState, useEffect, useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  signIn,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
} from "@/lib/actions/auth.actions";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "code";

const SLOW_NETWORK_MS = 7000;

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: 15,
  outline: "none",
};

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tOtp = useTranslations("auth.loginOtp");
  const tCommon = useTranslations("common");

  const [mode, setMode] = useState<LoginMode>("password");
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const [signInState, signInAction, signInPending] = useActionState(signIn, null);
  const [sendState, sendAction, sendPending] = useActionState(sendEmailLoginOtp, null);
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyEmailLoginOtp,
    null
  );

  const authBusy = signInPending || sendPending || verifyPending;

  useEffect(() => {
    if (!sendState?.success) return;
    queueMicrotask(() => {
      setOtpStep("code");
      setCooldown(60);
    });
  }, [sendState?.success]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!authBusy) return;
    const id = setTimeout(() => setShowSlowHint(true), SLOW_NETWORK_MS);
    return () => {
      clearTimeout(id);
      setShowSlowHint(false);
    };
  }, [authBusy]);

  function switchMode(next: LoginMode) {
    if (authBusy) return;
    setMode(next);
    if (next === "otp") {
      setOtpStep("email");
      setCooldown(0);
    }
  }

  const slowHintText = mode === "password" ? t("slowNetworkHint") : tOtp("slowNetworkHint");

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
          {t("title")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
          {mode === "password" ? t("subtitle") : tOtp("subtitle")}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => switchMode("password")}
          disabled={authBusy}
          style={{
            fontSize: 14,
            fontWeight: mode === "password" ? 600 : 400,
            color: mode === "password" ? "var(--brand)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            cursor: authBusy ? "not-allowed" : "pointer",
            opacity: authBusy ? 0.55 : 1,
            textDecoration: mode === "password" ? "underline" : "none",
            padding: "4px 8px",
          }}
        >
          {t("usePassword")}
        </button>
        <span style={{ color: "var(--border)", userSelect: "none" }}>|</span>
        <button
          type="button"
          onClick={() => switchMode("otp")}
          disabled={authBusy}
          style={{
            fontSize: 14,
            fontWeight: mode === "otp" ? 600 : 400,
            color: mode === "otp" ? "var(--brand)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            cursor: authBusy ? "not-allowed" : "pointer",
            opacity: authBusy ? 0.55 : 1,
            textDecoration: mode === "otp" ? "underline" : "none",
            padding: "4px 8px",
          }}
        >
          {t("useEmailCode")}
        </button>
      </div>

      {authBusy && showSlowHint && (
        <p
          role="status"
          aria-live="polite"
          style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--text-secondary)",
            background: "var(--bg-subtle)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {slowHintText}
        </p>
      )}

      {mode === "password" && (
        <form
          action={signInAction}
          aria-busy={signInPending}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {signInState?.error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: 10,
                color: "var(--danger)",
                fontSize: 14,
              }}
            >
              {signInState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: "var(--text-primary)",
              }}
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
              disabled={signInPending}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: "var(--text-primary)",
              }}
            >
              {tCommon("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={signInPending}
              style={inputStyle}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}
            >
              {t("forgotPassword")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={signInPending}
            className="btn-primary"
            style={{ width: "100%", padding: "14px", justifyContent: "center" }}
          >
            {signInPending ? (
              <>
                <Loader2
                  size={18}
                  strokeWidth={2.25}
                  className="animate-spin motion-reduce:animate-none shrink-0"
                  aria-hidden
                />
                <span>{t("submitting")}</span>
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>
      )}

      {mode === "otp" && otpStep === "email" && (
        <form
          action={sendAction}
          aria-busy={sendPending}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {sendState?.error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: 10,
                color: "var(--danger)",
                fontSize: 14,
              }}
            >
              {sendState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="otp-email"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
                color: "var(--text-primary)",
              }}
            >
              {tCommon("email")}
            </label>
            <input
              id="otp-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={sendPending}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={sendPending}
            className="btn-primary"
            style={{ width: "100%", padding: "14px", justifyContent: "center" }}
          >
            {sendPending ? (
              <>
                <Loader2
                  size={18}
                  strokeWidth={2.25}
                  className="animate-spin motion-reduce:animate-none shrink-0"
                  aria-hidden
                />
                <span>{tOtp("sendingCode")}</span>
              </>
            ) : (
              tOtp("sendCode")
            )}
          </button>
        </form>
      )}

      {mode === "otp" && otpStep === "code" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <form
            action={verifyAction}
            aria-busy={verifyPending}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {verifyState?.error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.1)",
                  borderRadius: 10,
                  color: "var(--danger)",
                  fontSize: 14,
                }}
              >
                {verifyState.error}
              </div>
            )}

            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {tOtp("codeSentHint")}
            </p>

            <input type="hidden" name="email" value={otpEmail} readOnly />

            <div>
              <label
                htmlFor="otp-token"
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 8,
                  color: "var(--text-primary)",
                }}
              >
                {tOtp("otpCode")}
              </label>
              <input
                id="otp-token"
                name="token"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="one-time-code"
                required
                placeholder={tOtp("otpPlaceholder")}
                disabled={verifyPending || sendPending}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={verifyPending}
              className="btn-primary"
              style={{ width: "100%", padding: "14px", justifyContent: "center" }}
            >
              {verifyPending ? (
                <>
                  <Loader2
                    size={18}
                    strokeWidth={2.25}
                    className="animate-spin motion-reduce:animate-none shrink-0"
                    aria-hidden
                  />
                  <span>{tOtp("verifying")}</span>
                </>
              ) : (
                tOtp("verify")
              )}
            </button>
          </form>

          <form action={sendAction} aria-busy={sendPending} style={{ margin: 0 }}>
            <input type="hidden" name="email" value={otpEmail} readOnly />
            <button
              type="submit"
              disabled={sendPending || cooldown > 0}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "12px",
                justifyContent: "center",
                opacity: sendPending || cooldown > 0 ? 0.6 : 1,
                background: "transparent",
                color: "var(--brand)",
                border: "1px solid var(--border)",
              }}
            >
              {cooldown > 0 ? (
                tOtp("resendWait", { seconds: cooldown })
              ) : sendPending ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2.25}
                    className="animate-spin motion-reduce:animate-none shrink-0"
                    aria-hidden
                  />
                  <span>{tOtp("sendingCode")}</span>
                </>
              ) : (
                tOtp("resend")
              )}
            </button>
          </form>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => {
              setOtpStep("email");
              setCooldown(0);
            }}
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              background: "none",
              border: "none",
              cursor: authBusy ? "not-allowed" : "pointer",
              opacity: authBusy ? 0.55 : 1,
              textAlign: "center",
            }}
          >
            {tOtp("backEditEmail")}
          </button>
        </div>
      )}

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-secondary)" }}>
        {t("noAccount")}{" "}
        <Link href="/register" style={{ color: "var(--brand)", textDecoration: "none" }}>
          {t("registerNow")}
        </Link>
      </p>
    </>
  );
}
