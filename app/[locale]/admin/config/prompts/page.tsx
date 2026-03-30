import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ConfigService } from "@/lib/services/config.service";
import { promptsSchema } from "@/lib/schemas/config.schemas";
import styles from "./PromptsListPage.module.css";

export default async function PromptsListPage() {
  const t = await getTranslations("admin.prompts");
  const prompts = await ConfigService.get("prompts", promptsSchema);

  const keys = Object.keys(prompts);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("heroEyebrow")}</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.lead}>{t("subtitle")}</p>
        <div className={styles.metaRow}>
          <span className={styles.countBadge}>{t("countLabel", { count: keys.length })}</span>
        </div>
      </header>

      <section className={styles.catalog} aria-labelledby="prompt-catalog-heading">
        <div className={styles.catalogHeader}>
          <h2 id="prompt-catalog-heading" className={styles.catalogTitle}>
            {t("listTitle")}
          </h2>
          <p className={styles.catalogLead}>{t("listLead")}</p>
        </div>

        <div className={styles.panel}>
          {keys.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t("emptyTitle")}</p>
              <p className={styles.emptyBody}>{t("emptyBody")}</p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.theadRow}>
                    <th scope="col" className={styles.th}>
                      {t("key")}
                    </th>
                    <th scope="col" className={styles.th}>
                      {t("description")}
                    </th>
                    <th scope="col" className={styles.th}>
                      {t("version")}
                    </th>
                    <th scope="col" className={styles.th}>
                      {t("edit")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const item = prompts[key];
                    return (
                      <tr key={key} className={styles.tr}>
                        <td className={styles.tdKey}>{key}</td>
                        <td className={styles.tdDesc}>{item.description}</td>
                        <td className={styles.tdVersion}>{item.version}</td>
                        <td className={styles.tdAction}>
                          <Link
                            href={`/admin/config/prompts/${encodeURIComponent(key)}`}
                            className={styles.editLink}
                          >
                            <span>{t("openEditor")}</span>
                            <span className={styles.editArrow} aria-hidden>
                              →
                            </span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className={styles.footnote}>{t("footnote")}</p>
      </section>
    </div>
  );
}
