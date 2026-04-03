import styles from "./admin-config.module.css";

export type AdminDashboardCardVM = {
  label: string;
  value: string;
  hint: string;
};

export type AdminDashboardSectionProps = {
  sectionTitle: string;
  sectionLead: string;
  cards: AdminDashboardCardVM[];
};

/** 纯展示：文案与数字均由页面层组装后传入 */
export function AdminDashboardSection({ sectionTitle, sectionLead, cards }: AdminDashboardSectionProps) {
  return (
    <section className={styles.dashboardSection} aria-labelledby="admin-dashboard-heading">
      <div className={styles.dashboardPanel}>
        <div className={styles.dashboardPanelInner}>
          <header className={styles.dashboardHeader}>
            <h2 id="admin-dashboard-heading" className={styles.dashboardTitle}>
              {sectionTitle}
            </h2>
            <p className={styles.dashboardLead}>{sectionLead}</p>
          </header>
          <div className={styles.statGrid}>
            {cards.map((item) => (
              <div key={item.label} className={styles.statCard}>
                <div className={styles.statLabel}>{item.label}</div>
                <div className={styles.statValue}>{item.value}</div>
                <div className={styles.statHint}>{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
