"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BillingConfig, ModuleConsumptionRule, ModuleCosts } from "@/lib/schemas/config.schemas";

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
        throw new Error(err.error ?? "Save failed");
      }

      router.refresh();
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const inputStyle = {
    padding: 8,
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 13,
    width: "100%",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {error && (
        <div
          style={{
            padding: 12,
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 8,
            color: "var(--error)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Meta */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Version", value: version, set: setVersion, type: "text" },
          { label: "Currency", value: currency, set: setCurrency, type: "text" },
        ].map(({ label, value, set, type }) => (
          <div key={label}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {label}
            </label>
            <input
              type={type}
              value={value}
              onChange={(e) => set(e.target.value)}
              style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            />
          </div>
        ))}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("maxAllowedWords")}
          </label>
          <input
            type="number"
            value={maxAllowedWords}
            onChange={(e) => setMaxAllowedWords(e.target.value)}
            style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
          />
        </div>
      </div>

      {/* Packages */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t("packages")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {packages.map((pkg, i) => (
            <div
              key={pkg.id}
              style={{
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 12,
              }}
            >
              <input type="hidden" value={pkg.id} readOnly />
              {(["name", "nameZh"] as const).map((f) => (
                <div key={f}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>{f}</label>
                  <input
                    value={pkg[f]}
                    onChange={(e) => updatePackage(i, f, e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ))}
              {(["credits", "price", "original_price"] as const).map((f) => (
                <div key={f}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)" }}>{f}</label>
                  <input
                    type="number"
                    value={pkg[f]}
                    onChange={(e) => updatePackage(i, f, parseInt(e.target.value, 10) || 0)}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>tag</label>
                <input
                  value={pkg.tag ?? ""}
                  onChange={(e) =>
                    updatePackage(i, "tag", e.target.value === "" ? null : e.target.value)
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module Consumption Rules */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          {t("consumptionRules")}
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px repeat(4, 1fr)",
            gap: "8px 12px",
            alignItems: "center",
          }}
        >
          {/* Header */}
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>max_words</span>
          {MODULE_KEYS.map((k) => (
            <span key={k} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textAlign: "center" }}>
              {k}
            </span>
          ))}

          {/* Rows */}
          {consumptionRules.map((rule, i) => (
            <React.Fragment key={i}>
              <input
                type="number"
                value={rule.max_words}
                onChange={(e) => updateRuleMaxWords(i, parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
              {MODULE_KEYS.map((k) => (
                <input
                  key={`${k}-${i}`}
                  type="number"
                  value={rule.costs[k]}
                  onChange={(e) => updateRuleCost(i, k, parseInt(e.target.value, 10) || 0)}
                  style={{ ...inputStyle, textAlign: "center" }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          单位：积分（整数）。各维度为该字数档下单独消耗的积分数，未勾选模块不扣费。
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "12px 24px",
          background: "var(--brand)",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : t("save")}
      </button>
    </form>
  );
}
