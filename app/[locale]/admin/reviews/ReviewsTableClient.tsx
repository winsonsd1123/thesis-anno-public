"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { AdminReviewListRow } from "@/lib/dal/review.admin.dal";

const STATUS_KEYS = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "needs_manual_review",
  "refunded",
] as const;

function isReviewStatus(s: string): s is (typeof STATUS_KEYS)[number] {
  return (STATUS_KEYS as readonly string[]).includes(s);
}

function ReviewRow({ row }: { row: AdminReviewListRow }) {
  const t = useTranslations("admin.reviews");
  const format = useFormatter();

  const completedLabel =
    row.completed_at != null && row.completed_at.length > 0
      ? format.dateTime(new Date(row.completed_at), { dateStyle: "short", timeStyle: "short" })
      : t("completedAtEmpty");

  const statusLabel = isReviewStatus(row.status) ? t(`status_${row.status}`) : row.status;

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
        {row.file_name?.trim() ? row.file_name : t("untitled")}
      </td>
      <td
        style={{
          padding: "14px 16px",
          fontSize: 13,
          color: "var(--text-secondary)",
          maxWidth: 240,
          wordBreak: "break-all",
        }}
      >
        {row.user_email}
      </td>
      <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{completedLabel}</td>
      <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-primary)" }}>{statusLabel}</td>
      <td style={{ padding: "14px 16px" }}>
        <Link
          href={`/admin/reviews/${row.id}`}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          {t("viewReport")}
        </Link>
      </td>
    </tr>
  );
}

export default function ReviewsTableClient({ rows }: { rows: AdminReviewListRow[] }) {
  const t = useTranslations("admin.reviews");

  if (rows.length === 0) {
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
      <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
            {(["colTitle", "colEmail", "colCompletedAt", "colStatus", "colActions"] as const).map((col) => (
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
          {rows.map((row) => (
            <ReviewRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
