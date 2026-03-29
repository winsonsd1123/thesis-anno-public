"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { TransactionFilterParam, TransactionListItem } from "@/lib/actions/transaction.actions";
import type { CreditTransactionType } from "@/lib/dal/transaction.dal";

type Props = {
  items: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  filter: TransactionFilterParam;
};

function formatAmount(amount: number): string {
  if (amount > 0) return `+${amount}`;
  return String(amount);
}

function moduleLabel(key: string, trReview: (key: string) => string): string {
  switch (key) {
    case "logic":
      return trReview("planItemLogic");
    case "format":
      return trReview("planItemFormat");
    case "aitrace":
      return trReview("planItemAitrace");
    case "reference":
      return trReview("planItemRefs");
    case "total":
      return trReview("planStatsCreditsLabel");
    default:
      return key;
  }
}

function typeLabel(type: CreditTransactionType, t: (key: string) => string): string {
  switch (type) {
    case "deposit":
      return t("typeDeposit");
    case "consumption":
      return t("typeConsumption");
    case "refund":
      return t("typeRefund");
    case "partial_refund":
      return t("typePartialRefund");
    case "admin_adjustment":
      return t("typeAdminAdjustment");
    case "bonus":
      return t("typeBonus");
    default:
      return type;
  }
}

export function TransactionList({ items, total, page, limit, filter }: Props) {
  const t = useTranslations("billing.transactions");
  const trReview = useTranslations("dashboard.review");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const queryBase = (p: number, f: TransactionFilterParam) => {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (f !== "all") q.set("filter", f);
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const filters: { key: TransactionFilterParam; labelKey: "filterAll" | "filterDeposit" | "filterConsumption" | "filterRefunds" }[] = [
    { key: "all", labelKey: "filterAll" },
    { key: "deposit", labelKey: "filterDeposit" },
    { key: "consumption", labelKey: "filterConsumption" },
    { key: "refunds", labelKey: "filterRefunds" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {filters.map(({ key, labelKey }) => (
          <Link
            key={key}
            href={`/dashboard/transactions${queryBase(1, key)}`}
            style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: 100,
              textDecoration: "none",
              border: "1px solid var(--border)",
              background: filter === key ? "var(--brand-bg)" : "var(--surface)",
              color: filter === key ? "var(--brand)" : "var(--text-secondary)",
              fontWeight: filter === key ? 600 : 400,
            }}
          >
            {t(labelKey)}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noData")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(({ transaction: tx, order, review, costBreakdown }) => {
            const isOpen = expandedId === tx.id;
            const meta = tx.metadata;
            const partialAgent =
              meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).agent === "string"
                ? String((meta as Record<string, unknown>).agent)
                : null;
            const partialReason =
              meta && typeof meta === "object" && (meta as Record<string, unknown>).reason != null
                ? String((meta as Record<string, unknown>).reason)
                : null;

            return (
              <div
                key={tx.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : tx.id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "14px 16px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {typeLabel(tx.type, t)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {order && (
                        <span>
                          {t("orderLabel")} · {order.package_id} · {t("paidYuan", { amount: order.amount_paid.toFixed(2) })}
                        </span>
                      )}
                      {review && (
                        <span>
                          {order ? " · " : ""}
                          {t("reviewLabel")} #{review.id} · {review.file_name ?? t("untitledReview")}
                        </span>
                      )}
                      {!order && !review && tx.reference_id && (
                        <span>
                          {t("refLabel")}: {tx.reference_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: tx.amount >= 0 ? "var(--success)" : "var(--text-primary)",
                    }}
                  >
                    {formatAmount(tx.amount)} {t("creditsUnit")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {t("colBalanceAfter")}
                    <br />
                    <strong style={{ color: "var(--text-primary)" }}>{tx.balance_after}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--brand)" }}>{isOpen ? t("collapse") : t("expand")}</div>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "12px 16px 16px",
                      borderTop: "1px solid var(--border)",
                      background: "var(--bg-subtle)",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {costBreakdown && Object.keys(costBreakdown).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                          {t("breakdownTitle")}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                          {Object.entries(costBreakdown).map(([k, v]) => (
                            <li key={k}>
                              {moduleLabel(k, trReview)}: <strong>{v}</strong> {t("creditsUnit")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tx.type === "partial_refund" && (partialAgent || partialReason) && (
                      <div style={{ marginBottom: 8 }}>
                        {partialAgent && (
                          <div>
                            {t("partialAgent")}: {moduleLabel(partialAgent, trReview)}
                          </div>
                        )}
                        {partialReason && (
                          <div>
                            {t("reason")}: {partialReason}
                          </div>
                        )}
                      </div>
                    )}
                    {meta && Object.keys(meta).length > 0 && (
                      <details>
                        <summary style={{ cursor: "pointer", marginBottom: 8 }}>{t("rawMetadata")}</summary>
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            borderRadius: 8,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            fontSize: 11,
                            overflow: "auto",
                            maxHeight: 200,
                          }}
                        >
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            marginTop: 24,
          }}
        >
          {page > 1 ? (
            <Link
              href={`/dashboard/transactions${queryBase(page - 1, filter)}`}
              style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}
            >
              {t("pagePrev")}
            </Link>
          ) : (
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("pagePrev")}</span>
          )}
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {t("pageStatus", { page, totalPages, total })}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/transactions${queryBase(page + 1, filter)}`}
              style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}
            >
              {t("pageNext")}
            </Link>
          ) : (
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("pageNext")}</span>
          )}
        </div>
      )}
    </div>
  );
}
