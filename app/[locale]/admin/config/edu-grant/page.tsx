import { getTranslations } from "next-intl/server";
import { eduCreditGrantService } from "@/lib/services/edu-credit-grant.service";
import { EduGrantAdminClient } from "./EduGrantAdminClient";
import { EduGrantHistorySection } from "./EduGrantHistorySection";

export default async function AdminEduGrantPage({
  searchParams,
}: {
  searchParams: Promise<{
    histPage?: string;
    histFrom?: string;
    histTo?: string;
    histEmail?: string;
  }>;
}) {
  const t = await getTranslations("admin.eduGrant");
  const sp = await searchParams;
  const histPage = Math.max(1, parseInt(sp.histPage ?? "1", 10) || 1);
  const histFrom = sp.histFrom ?? "";
  const histTo = sp.histTo ?? "";
  const histEmail = sp.histEmail ?? "";

  const { openWindow, claimCount } = await eduCreditGrantService.getAdminPanelSnapshot();
  const history = await eduCreditGrantService.getAdminHistoryRounds({
    page: histPage,
    histFrom: histFrom || null,
    histTo: histTo || null,
    histEmail: histEmail || null,
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <div style={{ maxWidth: 640 }}>
        <EduGrantAdminClient
          openWindow={
            openWindow
              ? { id: openWindow.id, opened_at: openWindow.opened_at, max_claims: openWindow.max_claims }
              : null
          }
          claimCount={claimCount}
        />
      </div>

      <EduGrantHistorySection
        rounds={history.rounds}
        total={history.total}
        page={history.page}
        pageSize={history.pageSize}
        histFrom={histFrom}
        histTo={histTo}
        histEmail={histEmail}
      />
    </div>
  );
}
