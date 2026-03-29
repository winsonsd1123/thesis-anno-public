"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  closeEduCreditGrantWindowAdmin,
  openEduCreditGrantWindowAdmin,
} from "@/lib/actions/admin-edu-credit-grant.actions";

type Props = {
  openWindow: {
    id: string;
    opened_at: string;
    max_claims: number;
  } | null;
  claimCount: number;
};

const DEFAULT_MAX_INPUT = "10";

export function EduGrantAdminClient({ openWindow, claimCount }: Props) {
  const t = useTranslations("admin.eduGrant");
  const router = useRouter();
  const [busy, setBusy] = useState<"open" | "close" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [maxClaimsInput, setMaxClaimsInput] = useState(DEFAULT_MAX_INPUT);

  async function onOpen() {
    setMsg(null);
    setBusy("open");
    try {
      const parsed = Number.parseInt(maxClaimsInput.trim(), 10);
      const res = await openEduCreditGrantWindowAdmin(Number.isFinite(parsed) ? parsed : undefined);
      if (res.success) {
        setMsg({ ok: true, text: t("openSuccess") });
        router.refresh();
      } else {
        setMsg({
          ok: false,
          text: res.error === "UNAUTHORIZED" ? t("unauthorized") : t("error"),
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onClose() {
    setMsg(null);
    setBusy("close");
    try {
      const res = await closeEduCreditGrantWindowAdmin();
      if (res.success) {
        setMsg({ ok: true, text: t("closeSuccess") });
        router.refresh();
      } else {
        setMsg({
          ok: false,
          text: res.error === "UNAUTHORIZED" ? t("unauthorized") : t("error"),
        });
      }
    } finally {
      setBusy(null);
    }
  }

  const openedLabel = openWindow
    ? new Date(openWindow.opened_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
        {openWindow ? t("statusOpen") : t("statusClosed")}
      </p>
      {openWindow && (
        <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>
          <strong>{t("openedAt")}:</strong> {openedLabel}
        </div>
      )}
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 20 }}>
        <strong>{t("claimCount")}:</strong>{" "}
        {openWindow
          ? t("claimCountOfMax", { count: claimCount, max: openWindow.max_claims })
          : claimCount}
      </div>
      {!openWindow && (
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="edu-grant-max-claims"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            {t("maxClaimsLabel")}
          </label>
          <input
            id="edu-grant-max-claims"
            type="number"
            min={1}
            max={10000}
            value={maxClaimsInput}
            onChange={(e) => setMaxClaimsInput(e.target.value)}
            style={{
              width: 120,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
            }}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            {t("maxClaimsHint")}
          </p>
        </div>
      )}
      {msg && (
        <p
          style={{
            fontSize: 14,
            marginBottom: 16,
            color: msg.ok ? "var(--success)" : "var(--error)",
          }}
        >
          {msg.text}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onOpen()}
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
          {busy === "open" ? t("opening") : t("openWindow")}
        </button>
        <button
          type="button"
          disabled={busy !== null || !openWindow}
          onClick={() => void onClose()}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            color: "var(--text-primary)",
            fontWeight: 600,
            fontSize: 14,
            cursor: busy || !openWindow ? "not-allowed" : "pointer",
            opacity: busy || !openWindow ? 0.6 : 1,
          }}
        >
          {busy === "close" ? t("closing") : t("closeWindow")}
        </button>
      </div>
    </div>
  );
}
