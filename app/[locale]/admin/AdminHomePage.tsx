import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { adminStatsService } from "@/lib/services/admin-stats.service";
import styles from "./config/admin-config.module.css";
import { AdminDashboardSection } from "./config/AdminDashboardSection";

export async function AdminHomePage() {
  const [t, td, th, locale, stats] = await Promise.all([
    getTranslations("admin.config"),
    getTranslations("admin.dashboard"),
    getTranslations("admin.home"),
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
      <header className={styles.homeHero} aria-labelledby="admin-home-title">
        <div className={styles.homeHeroAccent} aria-hidden />
        <div className={styles.homeHeroInner}>
          <span className={styles.homeEyebrow}>{th("eyebrow")}</span>
          <h1 id="admin-home-title" className={styles.homeTitle}>
            {th("pageTitle")}
          </h1>
          <p className={styles.homeLead}>{th("pageLead")}</p>
        </div>
      </header>

      <div id="admin-dashboard" className={styles.dashboardAnchor}>
        <AdminDashboardSection
          sectionTitle={td("sectionTitle")}
          sectionLead={td("sectionLead")}
          cards={dashboardCards}
        />
      </div>

      <section className={styles.configSection} aria-labelledby="admin-config-shortcuts-heading">
        <header className={styles.configSectionHeader}>
          <h2 id="admin-config-shortcuts-heading" className={styles.configTitle}>
            {th("sectionConfigTitle")}
          </h2>
          <p className={styles.configSubtitle}>{th("sectionConfigLead")}</p>
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

      <section className={styles.opsSection} aria-labelledby="admin-ops-shortcuts-heading">
        <header className={styles.opsSectionHeader}>
          <h2 id="admin-ops-shortcuts-heading" className={styles.opsSectionTitle}>
            {th("sectionOpsTitle")}
          </h2>
          <p className={styles.opsSectionLead}>{th("sectionOpsLead")}</p>
        </header>

        <div className={styles.opsGrid}>
          <Link href="/admin/order-query" className={styles.opsCard} data-area="order-query">
            <span className={styles.opsCardMark} aria-hidden />
            <div className={styles.opsCardBody}>
              <div className={styles.opsCardTitle}>{th("opsOrderQueryTitle")}</div>
              <div className={styles.opsCardDesc}>{th("opsOrderQueryLead")}</div>
            </div>
            <span className={styles.opsCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/users" className={styles.opsCard} data-area="users">
            <span className={styles.opsCardMark} aria-hidden />
            <div className={styles.opsCardBody}>
              <div className={styles.opsCardTitle}>{th("opsUsersTitle")}</div>
              <div className={styles.opsCardDesc}>{th("opsUsersLead")}</div>
            </div>
            <span className={styles.opsCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/tickets" className={styles.opsCard} data-area="tickets">
            <span className={styles.opsCardMark} aria-hidden />
            <div className={styles.opsCardBody}>
              <div className={styles.opsCardTitle}>{th("opsTicketsTitle")}</div>
              <div className={styles.opsCardDesc}>{th("opsTicketsLead")}</div>
            </div>
            <span className={styles.opsCardArrow} aria-hidden>
              →
            </span>
          </Link>
          <Link href="/admin/messages" className={styles.opsCard} data-area="messages">
            <span className={styles.opsCardMark} aria-hidden />
            <div className={styles.opsCardBody}>
              <div className={styles.opsCardTitle}>{th("opsMessagesTitle")}</div>
              <div className={styles.opsCardDesc}>{th("opsMessagesLead")}</div>
            </div>
            <span className={styles.opsCardArrow} aria-hidden>
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
