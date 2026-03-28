"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  refundSuspendedReviewAndResolveTicket,
  resolveSupportTicketOnly,
} from "@/lib/actions/support-ticket.admin.actions";
import type { SupportTicketRow } from "@/lib/dal/support-ticket.admin.dal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--error)",
  medium: "var(--warning, #f59e0b)",
  low: "var(--text-secondary)",
};

function TicketRow({ ticket }: { ticket: SupportTicketRow }) {
  const t = useTranslations("admin.tickets");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefundResolve = () => {
    if (!confirm(t("confirmRefundResolve"))) return;
    startTransition(async () => {
      const result = await refundSuspendedReviewAndResolveTicket(ticket.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(t("actionError", { message: result.error }));
      }
    });
  };

  const handleResolveOnly = () => {
    if (!confirm(t("confirmResolveOnly"))) return;
    startTransition(async () => {
      const result = await resolveSupportTicketOnly(ticket.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(t("actionError", { message: result.error }));
      }
    });
  };

  const reviewInfo = ticket.reviews;

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--border)",
        opacity: isPending ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <td style={{ padding: "14px 16px", fontSize: 14 }}>
        <div style={{ fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
          {ticket.subject}
        </div>
        {ticket.description && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ticket.description}
          </div>
        )}
      </td>
      <td style={{ padding: "14px 16px", fontSize: 13 }}>
        <span
          style={{
            color: PRIORITY_COLOR[ticket.priority ?? "low"] ?? "var(--text-secondary)",
            fontWeight: ticket.priority === "high" ? 600 : 400,
          }}
        >
          {ticket.priority ?? "—"}
        </span>
      </td>
      <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
        {ticket.created_at ? formatDate(ticket.created_at) : "—"}
      </td>
      <td style={{ padding: "14px 16px", fontSize: 13 }}>
        {ticket.review_id ? (
          <div>
            <span style={{ color: "var(--text-primary)" }}>#{ticket.review_id}</span>
            {reviewInfo?.file_name && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {reviewInfo.file_name}
              </div>
            )}
            {reviewInfo?.status && (
              <div style={{ fontSize: 11, color: "var(--error)", marginTop: 2 }}>
                {reviewInfo.status}
              </div>
            )}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ticket.review_id && (
            <button
              onClick={handleRefundResolve}
              disabled={isPending}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 500,
                background: "var(--error)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: isPending ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isPending ? t("processing") : t("btnRefundResolve")}
            </button>
          )}
          <button
            onClick={handleResolveOnly}
            disabled={isPending}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 500,
              background: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: isPending ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isPending ? t("processing") : t("btnResolveOnly")}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TicketsTableClient({ tickets }: { tickets: SupportTicketRow[] }) {
  const t = useTranslations("admin.tickets");

  if (tickets.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "64px 24px",
          color: "var(--text-secondary)",
          fontSize: 15,
        }}
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
            {(
              [
                "colSubject",
                "colPriority",
                "colCreatedAt",
                "colReview",
                "colStatus",
              ] as const
            ).map((col) => (
              <th
                key={col}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {t(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
