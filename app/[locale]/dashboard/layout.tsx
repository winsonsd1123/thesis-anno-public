import { Plus_Jakarta_Sans } from "next/font/google";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileDAL } from "@/lib/dal/profile.dal";
import { getWalletBalance } from "@/lib/actions/billing.actions";
import { eduCreditGrantService } from "@/lib/services/edu-credit-grant.service";
import { userInboxService } from "@/lib/services/user-inbox.service";
import { DashboardTopBar } from "./DashboardTopBar";

const dashHeader = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-dash-header",
  display: "swap",
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/login");

  const profile = await profileDAL.getById(data.user.id);
  const isAdmin = profile?.role === "admin";

  const [balance, grantRound, inboxUnread] = await Promise.all([
    getWalletBalance(),
    eduCreditGrantService.getBillingGrantRoundInfo(data.user.id),
    userInboxService.countUnread(data.user.id),
  ]);
  const grantWindowOpen = grantRound.open;
  const grantNavEmphasized = grantRound.open
    ? eduCreditGrantService.getBillingUiEligibility({
        hasOpenWindow: true,
        claimedInOpenWindow:
          grantRound.open === true ? grantRound.userClaimedThisRound === true : false,
        balance: balance ?? 0,
        email: data.user.email ?? null,
        emailConfirmed: Boolean(data.user.email_confirmed_at),
      }).showApply
    : false;

  return (
    <div
      className={dashHeader.variable}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-subtle)",
      }}
    >
      <DashboardTopBar
        isAdmin={isAdmin}
        grantWindowOpen={grantWindowOpen}
        grantNavEmphasized={grantNavEmphasized}
        inboxUnread={inboxUnread}
        userEmail={data.user.email ?? ""}
      />

      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
