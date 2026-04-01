"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { C } from "./constants";
import type { BillingPackage } from "@/lib/config/billing";

const PLAN_IDS = ["pkg_single", "pkg_standard", "pkg_pro"] as const;
const PLAN_META = [
  { emoji: "⚡", color: C.brand, popular: false, saveKey: null as string | null },
  { emoji: "🔥", color: C.brand, popular: true, saveKey: "save" as string },
  { emoji: "💎", color: C.accent, popular: false, saveKey: "savePro" as string },
];

function formatPrice(priceFen: number): string {
  const yuan = priceFen / 100;
  return yuan % 1 === 0 ? yuan.toFixed(0) : yuan.toFixed(2);
}

export function Pricing({ packages }: { packages: BillingPackage[] }) {
  const t = useTranslations("landing.pricing");
  const router = useRouter();
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const plans = PLAN_IDS.map((id, i) => {
    const pkg = packages.find((p) => p.id === id);
    const priceStr = pkg ? `¥${formatPrice(pkg.price)}` : "";
    const hasSave = pkg && pkg.original_price > pkg.price;
    const originalPriceStr =
      pkg && pkg.original_price > pkg.price ? `¥${formatPrice(pkg.original_price)}` : null;
    const key = id.replace("pkg_", "") as "single" | "standard" | "pro";
    return {
      ...PLAN_META[i],
      id,
      price: priceStr,
      originalPrice: originalPriceStr,
      name: pkg?.nameZh ?? t(`plans.${key}.name`),
      nameEn: pkg?.name ?? t(`plans.${key}.nameEn`),
      unit: t(`plans.${key}.unit`),
      desc: t(`plans.${key}.desc`),
      save: hasSave && PLAN_META[i].saveKey ? t(PLAN_META[i].saveKey!) : null,
      features: t.raw(`plans.${key}.features`) as string[],
    };
  });

  const handleCardClick = (planId: string) => {
    setSelectedPkgId(planId);
  };

  const handleButtonClick = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (selectedPkgId === planId) {
      router.push("/dashboard/billing");
    } else {
      setSelectedPkgId(planId);
    }
  };

  return (
    <section id="pricing" style={{ padding: "96px 32px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge badge-accent" style={{ marginBottom: 18 }}>
            {t("badge")}
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-1.2px",
              color: C.textPrimary,
              marginBottom: 14,
            }}
          >
            {t("title")}<span className="gradient-text-warm">{t("titleHighlight")}</span>
          </h2>
          <p style={{ fontSize: 17, color: C.textSecondary, maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>
            {t("subtitle")}
          </p>
        </div>

        <div className="pricing-grid" style={{ alignItems: "stretch" }}>
          {plans.map((plan) => {
            const selected = selectedPkgId === plan.id;
            const isHighlighted = selected || (plan.popular && !selectedPkgId);
            return (
            <div
              key={plan.name}
              onClick={() => handleCardClick(plan.id)}
              className={isHighlighted && plan.popular ? "pricing-popular" : "card"}
              style={{
                padding: 28,
                borderRadius: 16,
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: isHighlighted
                  ? `2px solid ${plan.color}`
                  : `1.5px solid ${C.border}`,
                background: isHighlighted && plan.popular ? undefined : C.surface,
                position: "relative",
              }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -13,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: `linear-gradient(135deg, ${C.brand}, ${C.teal})`,
                    color: "white",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 18px",
                    borderRadius: 100,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(0,87,255,0.25)",
                    letterSpacing: "0.3px",
                  }}
                >
                  {t("plans.standard.popular")}
                </div>
              )}

              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
                      {plan.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "inherit" }}>
                      {plan.nameEn}
                    </div>
                  </div>
                  <span style={{ fontSize: 24 }}>{plan.emoji}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 42,
                      fontWeight: 800,
                      fontFamily: "inherit",
                      letterSpacing: "-1.5px",
                      color: C.textPrimary,
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.originalPrice && (
                    <span
                      style={{
                        fontSize: 18,
                        color: C.textMuted,
                        textDecoration: "line-through",
                      }}
                    >
                      {plan.originalPrice}
                    </span>
                  )}
                  <span style={{ fontSize: 14, color: C.textMuted }}>/ {plan.unit}</span>
                </div>

                {plan.save && (
                  <div className="badge badge-success" style={{ fontSize: 11, padding: "3px 10px", marginBottom: 8 }}>
                    {plan.save}
                  </div>
                )}

                <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55, marginTop: 8 }}>{plan.desc}</p>
              </div>

              <button
                onClick={(e) => handleButtonClick(e, plan.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "all 0.25s ease",
                  background: isHighlighted ? C.brand : C.bgSubtle,
                  border: isHighlighted ? "none" : `1.5px solid ${C.border}`,
                  color: isHighlighted ? "white" : C.textSecondary,
                  boxShadow: isHighlighted ? "var(--shadow-brand)" : "none",
                }}
              >
                {selected ? t("goToRecharge") : t("selectPlan")}
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: `${plan.color}12`,
                        color: plan.color,
                        fontSize: 10,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
          })}
        </div>

        <div
          style={{
            marginTop: 28,
            padding: "18px 24px",
            background: C.bgSubtle,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            display: "flex",
            gap: 24,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{t("rules")}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { pages: t("rule1"), cost: t("rule1Cost"), color: C.brand },
                { pages: t("rule2"), cost: t("rule2Cost"), color: C.teal },
                { pages: t("rule3"), cost: t("rule3Cost"), color: C.accent },
              ].map((rule) => (
                <div key={rule.pages} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      background: `${rule.color}0E`,
                      border: `1px solid ${rule.color}1A`,
                      color: rule.color,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 12px",
                      borderRadius: 100,
                    }}
                  >
                    {rule.pages}
                  </span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{rule.cost}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 1.5 }}>
              {t("ruleMaxNote")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
