import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPackages } from "@/lib/config/billing";
import { getWalletBalance } from "@/lib/actions/billing.actions";
import { BillingPlanSelector } from "@/app/components/billing/BillingPlanSelector";
import { EduGrantBillingSection } from "@/app/components/billing/EduGrantBillingSection";
import { createClient } from "@/lib/supabase/server";
import {
  eduCreditGrantService,
  EDU_GRANT_CREDIT_AMOUNT,
} from "@/lib/services/edu-credit-grant.service";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; trade_status?: string }>;
}) {
  const t = await getTranslations("billing");
  const tTx = await getTranslations("billing.transactions");
  const packages = await getPackages();
  const balance = await getWalletBalance();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  const grantRound = user
    ? await eduCreditGrantService.getBillingGrantRoundInfo(user.id)
    : { open: false as const };
  const grantUi = eduCreditGrantService.getBillingUiEligibility({
    hasOpenWindow: grantRound.open,
    claimedInOpenWindow:
      grantRound.open === true ? grantRound.userClaimedThisRound === true : false,
    balance: balance ?? 0,
    email: user?.email ?? null,
    emailConfirmed: Boolean(user?.email_confirmed_at),
  });
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
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{t("balance")}</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>
            {balance ?? 0} {t("credits")}
          </span>
        </div>
        <Link
          href="/dashboard/transactions"
          style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
        >
          {tTx("title")}
        </Link>
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

      {user && (
        <EduGrantBillingSection
          showApply={grantUi.showApply}
          blockReason={grantUi.reason}
          creditsAmount={EDU_GRANT_CREDIT_AMOUNT}
          roundQuota={
            grantRound.open
              ? {
                  remainingSlots: grantRound.remainingSlots,
                  maxClaims: grantRound.maxClaims,
                }
              : undefined
          }
        />
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
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
          <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("ruleMaxNote")}</span>
        </div>
      </div>
    </div>
  );
}
