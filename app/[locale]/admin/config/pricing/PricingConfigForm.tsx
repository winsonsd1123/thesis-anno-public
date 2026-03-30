"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BillingConfig, ModuleConsumptionRule, ModuleCosts } from "@/lib/schemas/config.schemas";
import styles from "./PricingConfigForm.module.css";

const MODULE_KEYS: (keyof ModuleCosts)[] = ["logic", "format", "aitrace", "reference"];

export function PricingConfigForm({ initialConfig }: { initialConfig: BillingConfig }) {
  const t = useTranslations("admin.pricing");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(initialConfig.version ?? "3.0.0");
  const [currency, setCurrency] = useState(initialConfig.currency ?? "CNY");
  const [maxAllowedWords, setMaxAllowedWords] = useState(
    String(initialConfig.max_allowed_words)
  );
  const [packages, setPackages] = useState(initialConfig.packages);
  const [consumptionRules, setConsumptionRules] = useState<ModuleConsumptionRule[]>(
    initialConfig.module_consumption_rules
  );

  function updatePackage(index: number, field: string, value: string | number | null) {
    setPackages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateRuleMaxWords(index: number, value: number) {
    setConsumptionRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], max_words: value };
      return next;
    });
  }

  function updateRuleMaxRefCount(index: number, raw: string) {
    setConsumptionRules((prev) => {
      const next = [...prev];
      const base = { ...next[index] };
      if (raw.trim() === "") {
        delete base.max_ref_count;
      } else {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) {
          base.max_ref_count = n;
        } else {
          delete base.max_ref_count;
        }
      }
      next[index] = base;
      return next;
    });
  }

  function updateRuleCost(index: number, module: keyof ModuleCosts, value: number) {
    setConsumptionRules((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        costs: { ...next[index].costs, [module]: value },
      };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: BillingConfig = {
        version,
        currency,
        packages: packages.map((p) => ({
          ...p,
          tag: p.tag === "" ? null : p.tag,
        })),
        module_consumption_rules: consumptionRules,
        max_allowed_words: parseInt(maxAllowedWords, 10) || 120000,
      };

      const res = await fetch("/api/admin/config/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t("saveError"));
      }

      router.refresh();
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Global meta */}
      <section className={styles.section} aria-labelledby="pricing-section-global">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>{t("sectionEyebrowGlobal")}</p>
          <h2 id="pricing-section-global" className={styles.sectionTitle}>
            {t("sectionTitleGlobal")}
          </h2>
          <p className={styles.sectionLead}>{t("sectionLeadGlobal")}</p>
        </header>
        <div className={styles.sectionBody}>
          <div className={styles.metaGrid}>
            <div>
              <label className={styles.fieldLabel} htmlFor="billing-version">
                {t("fieldVersion")}
              </label>
              <input
                id="billing-version"
                className={styles.input}
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="billing-currency">
                {t("fieldCurrency")}
              </label>
              <input
                id="billing-currency"
                className={styles.input}
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="billing-max-words">
                {t("maxAllowedWords")}
              </label>
              <input
                id="billing-max-words"
                className={styles.inputMono}
                type="number"
                min={1}
                value={maxAllowedWords}
                onChange={(e) => setMaxAllowedWords(e.target.value)}
              />
              <span className={styles.fieldHint}>{t("maxAllowedWordsHint")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className={styles.section} aria-labelledby="pricing-section-packages">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>{t("sectionEyebrowPackages")}</p>
          <h2 id="pricing-section-packages" className={styles.sectionTitle}>
            {t("packages")}
          </h2>
          <p className={styles.sectionLead}>{t("packagesLead")}</p>
        </header>
        <div className={styles.sectionBody}>
          <div className={styles.packageStack}>
            {packages.map((pkg, i) => (
              <div key={pkg.id} className={styles.packageCard}>
                <div className={styles.packageBar}>
                  <span className={styles.packageTitle}>
                    {pkg.nameZh?.trim() || pkg.name || t("packageUntitled")}
                  </span>
                  <span className={styles.packageId}>{pkg.id}</span>
                </div>
                <div className={styles.packageGrid}>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgName")}</label>
                    <input
                      className={styles.input}
                      value={pkg.name}
                      onChange={(e) => updatePackage(i, "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgNameZh")}</label>
                    <input
                      className={styles.input}
                      value={pkg.nameZh}
                      onChange={(e) => updatePackage(i, "nameZh", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgCredits")}</label>
                    <input
                      className={styles.inputMono}
                      type="number"
                      value={pkg.credits}
                      onChange={(e) => updatePackage(i, "credits", parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgPrice")}</label>
                    <input
                      className={styles.inputMono}
                      type="number"
                      value={pkg.price}
                      onChange={(e) => updatePackage(i, "price", parseInt(e.target.value, 10) || 0)}
                    />
                    <span className={styles.fieldHint}>{t("pkgPriceHint")}</span>
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgOriginalPrice")}</label>
                    <input
                      className={styles.inputMono}
                      type="number"
                      value={pkg.original_price}
                      onChange={(e) =>
                        updatePackage(i, "original_price", parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>{t("pkgTag")}</label>
                    <input
                      className={styles.input}
                      value={pkg.tag ?? ""}
                      onChange={(e) =>
                        updatePackage(i, "tag", e.target.value === "" ? null : e.target.value)
                      }
                      placeholder={t("pkgTagPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Word tiers + module costs */}
      <section className={styles.section} aria-labelledby="pricing-section-tiers">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>{t("sectionEyebrowTiers")}</p>
          <h2 id="pricing-section-tiers" className={styles.sectionTitle}>
            {t("consumptionRules")}
          </h2>
          <p className={styles.sectionLead}>{t("tiersLead")}</p>
        </header>
        <div className={styles.sectionBody}>
          <div className={styles.rulesScroll}>
            <div className={styles.rulesTable} role="group" aria-label={t("consumptionRules")}>
              <div className={styles.rulesRowGrid}>
                <span className={styles.rulesHeaderCell}>{t("columnWordCeiling")}</span>
                <span className={styles.rulesHeaderCell}>{t("columnRefCap")}</span>
                {MODULE_KEYS.map((k) => (
                  <span key={k} className={styles.rulesHeaderCellCenter}>
                    {t(`moduleLabels.${k}`)}
                  </span>
                ))}
              </div>

              {consumptionRules.map((rule, i) => (
                <div
                  key={i}
                  className={`${styles.rulesDataRow} ${styles.rulesRowGrid}${i % 2 === 1 ? ` ${styles.rulesDataRowAlt}` : ""}`}
                >
                  <input
                    type="number"
                    className={styles.inputMono}
                    min={1}
                    value={rule.max_words}
                    onChange={(e) => updateRuleMaxWords(i, parseInt(e.target.value, 10) || 0)}
                    aria-label={t("columnWordCeiling")}
                  />
                  <input
                    type="number"
                    min={1}
                    className={styles.inputMono}
                    placeholder={t("refCapPlaceholder")}
                    value={rule.max_ref_count ?? ""}
                    onChange={(e) => updateRuleMaxRefCount(i, e.target.value)}
                    title={t("maxRefCountHint")}
                    aria-label={t("columnRefCap")}
                  />
                  {MODULE_KEYS.map((k) => (
                    <input
                      key={`${k}-${i}`}
                      type="number"
                      className={styles.inputMono}
                      style={{ textAlign: "center" }}
                      value={rule.costs[k]}
                      onChange={(e) => updateRuleCost(i, k, parseInt(e.target.value, 10) || 0)}
                      aria-label={t("moduleCostAria", { module: t(`moduleLabels.${k}`) })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className={styles.rulesFootnote}>{t("tiersFootnote")}</p>
        </div>
      </section>

      <div className={styles.submitRow}>
        <button type="submit" className={styles.submitBtn} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
        <span className={styles.submitHint}>{t("submitHint")}</span>
      </div>
    </form>
  );
}
