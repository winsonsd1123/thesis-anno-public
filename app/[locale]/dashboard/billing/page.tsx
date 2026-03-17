import { getTranslations } from "next-intl/server";
import { getPackages } from "@/lib/config/billing";
import { getWalletBalance } from "@/lib/actions/billing.actions";
import { BillingPlanSelector } from "@/app/components/billing/BillingPlanSelector";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; trade_status?: string }>;
}) {
  const t = await getTranslations("billing");
  const packages = await getPackages();
  const balance = await getWalletBalance();
  const params = await searchParams;
  const paidSuccess = params.paid === "1" || params.trade_status === "TRADE_SUCCESS";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <div
        style={{
          padding: "16px 20px",
          background: "var(--surface)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          marginBottom: 32,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{t("balance")}</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>
          {balance ?? 0} {t("credits")}
        </span>
      </div>

      {paidSuccess && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.08)",
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14,
            color: "var(--success)",
          }}
        >
          {t("paidSuccess")}
        </div>
      )}

      <BillingPlanSelector packages={packages} />

      <div
        style={{
          padding: "16px 20px",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
          {t("rules")}
        </span>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 100,
              background: "var(--brand-bg)",
              color: "var(--brand)",
            }}
          >
            {t("rule1")} → {t("rule1Cost")}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 100,
              background: "var(--teal-bg)",
              color: "var(--teal)",
            }}
          >
            {t("rule2")} → {t("rule2Cost")}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 100,
              background: "var(--accent-bg)",
              color: "var(--accent)",
            }}
          >
            {t("rule3")} → {t("rule3Cost")}
          </span>
        </div>
      </div>
    </div>
  );
}
