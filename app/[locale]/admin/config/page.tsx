import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { adminStatsService } from "@/lib/services/admin-stats.service";
import styles from "./admin-config.module.css";
import { AdminDashboardSection } from "./AdminDashboardSection";

export default async function AdminConfigPage() {
  const [t, td, locale, stats] = await Promise.all([
    getTranslations("admin.config"),
    getTranslations("admin.dashboard"),
    getLocale(),
    adminStatsService.getDashboardStats(),
  ]);

  const intLocale = locale === "zh" ? "zh-CN" : "en-US";
  const fmtInt = new Intl.NumberFormat(intLocale);
  const fmtMoney = new Intl.NumberFormat(intLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dashboardCards = [
    {
      label: td("profileCount"),
      hint: td("profileCountHint"),
      value: fmtInt.format(stats.profileCount),
    },
    {
      label: td("revenueCny"),
      hint: td("revenueCnyHint"),
      value: fmtMoney.format(stats.revenueCny),
    },
    {
      label: td("paidOrders"),
      hint: td("paidOrdersHint"),
      value: fmtInt.format(stats.paidOrderCount),
    },
    {
      label: td("reviews"),
      hint: td("reviewsHint"),
      value: fmtInt.format(stats.reviewCount),
    },
    {
      label: td("pendingTickets"),
      hint: td("pendingTicketsHint"),
      value: fmtInt.format(stats.pendingTicketCount),
    },
  ];

  return (
    <div className={styles.page}>
      <div id="admin-dashboard" className={styles.dashboardAnchor}>
        <AdminDashboardSection
          sectionTitle={td("sectionTitle")}
          sectionLead={td("sectionLead")}
          cards={dashboardCards}
        />
      </div>

      <section className={styles.configSection} aria-labelledby="admin-config-heading">
        <header className={styles.configSectionHeader}>
          <h1 id="admin-config-heading" className={styles.configTitle}>
            {t("title")}
          </h1>
          <p className={styles.configSubtitle}>{t("subtitle")}</p>
        </header>

        <div className={styles.configGrid}>
          <Link href="/admin/config/prompts" className={styles.configCard} data-area="prompts">
            <span className={styles.configCardMark} aria-hidden />
            <div className={styles.configCardBody}>
              <div className={styles.configCardTitle}>{t("prompts")}</div>
              <div className={styles.configCardDesc}>{t("promptsLead")}</div>
            </div>
            <span className={styles.configCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/config/pricing" className={styles.configCard} data-area="pricing">
            <span className={styles.configCardMark} aria-hidden />
            <div className={styles.configCardBody}>
              <div className={styles.configCardTitle}>{t("pricing")}</div>
              <div className={styles.configCardDesc}>{t("pricingLead")}</div>
            </div>
            <span className={styles.configCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/config/system" className={styles.configCard} data-area="system">
            <span className={styles.configCardMark} aria-hidden />
            <div className={styles.configCardBody}>
              <div className={styles.configCardTitle}>{t("system")}</div>
              <div className={styles.configCardDesc}>{t("systemLead")}</div>
            </div>
            <span className={styles.configCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/config/edu-grant" className={styles.configCard} data-area="edu">
            <span className={styles.configCardMark} aria-hidden />
            <div className={styles.configCardBody}>
              <div className={styles.configCardTitle}>{t("eduGrant")}</div>
              <div className={styles.configCardDesc}>{t("eduGrantDesc")}</div>
            </div>
            <span className={styles.configCardArrow} aria-hidden>
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
