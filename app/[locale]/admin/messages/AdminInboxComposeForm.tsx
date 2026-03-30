"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendAdminInboxMessage } from "@/lib/actions/user-inbox.admin.actions";

export function AdminInboxComposeForm() {
  const t = useTranslations("admin.inbox");
  const [state, formAction, isPending] = useActionState(sendAdminInboxMessage, null);

  return (
    <form action={formAction} style={{ maxWidth: 640 }}>
      {state?.success === false && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.08)",
            borderRadius: 10,
            color: "var(--danger, #dc2626)",
            fontSize: 14,
            border: "1px solid rgba(239, 68, 68, 0.2)",
            marginBottom: 20,
          }}
        >
          {state.error}
        </div>
      )}

      {state?.success === true && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.08)",
            borderRadius: 10,
            color: "var(--success, #059669)",
            fontSize: 14,
            border: "1px solid rgba(16, 185, 129, 0.2)",
            marginBottom: 20,
          }}
        >
          {t("composeSuccess")}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label
          htmlFor="recipientEmail"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          {t("fieldRecipientEmail")}
        </label>
        <input
          id="recipientEmail"
          name="recipientEmail"
          type="email"
          required
          autoComplete="off"
          disabled={isPending}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label
          htmlFor="senderDisplayName"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          {t("fieldSenderName")}
        </label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px" }}>
          {t("fieldSenderNameHint")}
        </p>
        <input
          id="senderDisplayName"
          name="senderDisplayName"
          type="text"
          required
          maxLength={100}
          disabled={isPending}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label
          htmlFor="body"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          {t("fieldBody")}
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={10}
          disabled={isPending}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "10px 22px",
          fontSize: 14,
          fontWeight: 600,
          background: "var(--brand)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? t("composeSending") : t("composeSubmit")}
      </button>
    </form>
  );
}
