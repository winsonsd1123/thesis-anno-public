import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile.actions";
import { getWalletBalance as getBalance } from "@/lib/actions/billing.actions";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const profile = await getProfile();
  const balance = await getBalance();
  const t = await getTranslations("dashboard");
  const tBilling = await getTranslations("billing");
  const tCommon = await getTranslations("common");

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("welcome")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {profile?.fullName || data?.user?.email || tCommon("user")}
      </p>
      <Link
        href="/dashboard/billing"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          textDecoration: "none",
          color: "var(--text-primary)",
          fontSize: 14,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>{tBilling("balance")}</span>
        <span style={{ fontWeight: 700, color: "var(--brand)" }}>
          {balance ?? 0} {tBilling("credits")}
        </span>
      </Link>
    </div>
  );
}
