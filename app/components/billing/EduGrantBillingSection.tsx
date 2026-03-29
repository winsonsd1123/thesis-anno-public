"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { claimEduCreditGrant } from "@/lib/actions/edu-credit-grant.actions";
import type { EduBillingGrantBlockReason } from "@/lib/services/edu-credit-grant.service";
import type { ClaimEduCreditGrantActionResult } from "@/lib/actions/edu-credit-grant.actions";

type Props = {
  showApply: boolean;
  blockReason?: EduBillingGrantBlockReason;
  creditsAmount: number;
};

function hintKeyForReason(r: EduBillingGrantBlockReason): string {
  switch (r) {
    case "no_open_window":
      return "hintNoWindow";
    case "balance_not_zero":
      return "hintBalance";
    case "no_email":
      return "hintEmail";
    case "not_edu_email":
      return "hintNotEdu";
    case "email_not_confirmed":
      return "hintUnconfirmed";
    default:
      return "hintEmail";
  }
}

export function EduGrantBillingSection({ showApply, blockReason, creditsAmount }: Props) {
  const t = useTranslations("billing.eduGrant");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function formatClaimError(code: Extract<ClaimEduCreditGrantActionResult, { success: false }>["code"]) {
    switch (code) {
      case "NOT_LOGGED_IN":
        return t("errors.NOT_LOGGED_IN");
      case "EDU_GRANT_NO_OPEN_WINDOW":
        return t("errors.EDU_GRANT_NO_OPEN_WINDOW");
      case "EDU_GRANT_QUOTA_FULL":
        return t("errors.EDU_GRANT_QUOTA_FULL");
      case "EDU_GRANT_EMAIL_NOT_CONFIRMED":
        return t("errors.EDU_GRANT_EMAIL_NOT_CONFIRMED");
      case "EDU_GRANT_NOT_EDU_EMAIL":
        return t("errors.EDU_GRANT_NOT_EDU_EMAIL");
      case "EDU_GRANT_BALANCE_NOT_ZERO":
        return t("errors.EDU_GRANT_BALANCE_NOT_ZERO");
      case "EDU_GRANT_WALLET_NOT_FOUND":
        return t("errors.EDU_GRANT_WALLET_NOT_FOUND");
      case "EDU_GRANT_ALREADY_CLAIMED":
        return t("errors.EDU_GRANT_ALREADY_CLAIMED");
      case "EDU_GRANT_INVALID_USER":
        return t("errors.EDU_GRANT_INVALID_USER");
      case "EDU_GRANT_USER_NOT_FOUND":
        return t("errors.EDU_GRANT_USER_NOT_FOUND");
      default:
        return t("errors.UNKNOWN");
    }
  }

  async function onClaim() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await claimEduCreditGrant();
      if (res.success) {
        setMsg({ type: "ok", text: t("success") });
        router.refresh();
      } else {
        setMsg({ type: "err", text: formatClaimError(res.code) });
      }
    } finally {
      setBusy(false);
    }
  }

  const hint =
    !showApply && blockReason
      ? t(hintKeyForReason(blockReason) as "hintNoWindow")
      : null;

  return (
    <div
      id="edu-grant"
      style={{
        padding: "16px 20px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 24,
        scrollMarginTop: 72,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
        {t("description", { credits: creditsAmount })}
      </p>
      {hint && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{hint}</p>
      )}
      {msg && (
        <p
          style={{
            fontSize: 14,
            marginBottom: 12,
            color: msg.type === "ok" ? "var(--success)" : "var(--error)",
          }}
        >
          {msg.text}
        </p>
      )}
      {showApply && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClaim()}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "var(--brand)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? t("applying") : t("apply", { credits: creditsAmount })}
        </button>
      )}
    </div>
  );
}
