"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BillingConfig } from "@/lib/schemas/config.schemas";

export function PricingConfigForm({ initialConfig }: { initialConfig: BillingConfig }) {
  const t = useTranslations("admin.pricing");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(initialConfig.version ?? "1.0.0");
  const [currency, setCurrency] = useState(initialConfig.currency ?? "CNY");
  const [maxAllowedPages, setMaxAllowedPages] = useState(
    String(initialConfig.max_allowed_pages)
  );
  const [packages, setPackages] = useState(initialConfig.packages);
  const [consumptionRules, setConsumptionRules] = useState(
    initialConfig.consumption_rules
  );

  function updatePackage(index: number, field: string, value: string | number | null) {
    setPackages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateRule(index: number, field: string, value: number) {
    setConsumptionRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
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
        consumption_rules: consumptionRules,
        max_allowed_pages: parseInt(maxAllowedPages, 10) || 150,
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

      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Version
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            style={{
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Currency
          </label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t("maxAllowedPages")}
          </label>
          <input
            type="number"
            value={maxAllowedPages}
            onChange={(e) => setMaxAllowedPages(e.target.value)}
            style={{
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
      </div>

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
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>name</label>
                <input
                  value={pkg.name}
                  onChange={(e) => updatePackage(i, "name", e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>nameZh</label>
                <input
                  value={pkg.nameZh}
                  onChange={(e) => updatePackage(i, "nameZh", e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>credits</label>
                <input
                  type="number"
                  value={pkg.credits}
                  onChange={(e) => updatePackage(i, "credits", parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>price (分)</label>
                <input
                  type="number"
                  value={pkg.price}
                  onChange={(e) => updatePackage(i, "price", parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>original_price</label>
                <input
                  type="number"
                  value={pkg.original_price}
                  onChange={(e) =>
                    updatePackage(i, "original_price", parseInt(e.target.value, 10) || 0)
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>tag</label>
                <input
                  value={pkg.tag ?? ""}
                  onChange={(e) =>
                    updatePackage(i, "tag", e.target.value === "" ? null : e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t("consumptionRules")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {consumptionRules.map((rule, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14 }}>max_pages:</span>
              <input
                type="number"
                value={rule.max_pages}
                onChange={(e) => updateRule(i, "max_pages", parseInt(e.target.value, 10) || 0)}
                style={{
                  width: 100,
                  padding: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 14 }}>cost:</span>
              <input
                type="number"
                value={rule.cost}
                onChange={(e) => updateRule(i, "cost", parseInt(e.target.value, 10) || 0)}
                style={{
                  width: 80,
                  padding: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>
          ))}
        </div>
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
