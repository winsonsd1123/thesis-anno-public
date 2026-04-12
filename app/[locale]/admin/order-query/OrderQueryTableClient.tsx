"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { AdminCreditTransactionRow, CreditTransactionType } from "@/lib/dal/transaction.dal";
import type { OrderQueryUi } from "@/lib/services/admin-transaction.service";

function formatDt(iso: string | undefined, intlLocale: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(intlLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function typeLabelKey(t: CreditTransactionType): string {
  switch (t) {
    case "deposit":
      return "typeDeposit";
    case "consumption":
      return "typeConsumption";
    case "refund":
      return "typeRefund";
    case "partial_refund":
      return "typePartialRefund";
    case "admin_adjustment":
      return "typeAdminAdjustment";
    case "bonus":
      return "typeBonus";
    default:
      return "typeConsumption";
  }
}

function refPreview(ref: string | null, max = 36): string {
  if (!ref) return "—";
  return ref.length <= max ? ref : `${ref.slice(0, max)}…`;
}

type Props = {
  rows: AdminCreditTransactionRow[];
  page: number;
  totalPages: number;
  total: number;
  ui: OrderQueryUi;
};

export default function OrderQueryTableClient({ rows, page, totalPages, total, ui }: Props) {
  const t = useTranslations("admin.orderQuery");
  const tb = useTranslations("billing.transactions");
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-US" : "zh-CN";

  const q = new URLSearchParams();
  if (ui.email) q.set("email", ui.email);
  if (ui.from) q.set("from", ui.from);
  if (ui.to) q.set("to", ui.to);
  if (ui.type && ui.type !== "all") q.set("type", ui.type);

  const hrefPage = (p: number) => {
    q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/order-query?${s}` : `/admin/order-query?page=${p}`;
  };

  return (
    <div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colTime")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colEmail")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colType")}</th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>{t("colAmount")}</th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>{t("colBalanceAfter")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colReference")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                    {formatDt(row.created_at, intlLocale)}
                  </td>
                  <td style={{ padding: "12px 16px", wordBreak: "break-all" }}>{row.user_email ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{tb(typeLabelKey(row.type))}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.amount > 0 ? `+${row.amount}` : row.amount}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.balance_after}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 13,
                      wordBreak: "break-all",
                    }}
                  >
                    {refPreview(row.reference_id)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {t("pageInfo", { page, totalPages, total })}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {page > 1 ? (
            <Link
              href={hrefPage(page - 1)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 14,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              {t("pagePrev")}
            </Link>
          ) : (
            <span style={{ padding: "8px 14px", fontSize: 14, color: "var(--text-muted)" }}>{t("pagePrev")}</span>
          )}
          {page < totalPages ? (
            <Link
              href={hrefPage(page + 1)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 14,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              {t("pageNext")}
            </Link>
          ) : (
            <span style={{ padding: "8px 14px", fontSize: 14, color: "var(--text-muted)" }}>{t("pageNext")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
