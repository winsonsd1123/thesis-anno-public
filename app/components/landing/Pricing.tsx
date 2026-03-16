"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { C } from "./constants";

const PLAN_KEYS = ["single", "standard", "pro"] as const;
const PLAN_META = [
  { emoji: "⚡", price: "¥9.9", color: C.brand, popular: false, saveKey: null as string | null },
  { emoji: "🔥", price: "¥79", color: C.brand, popular: true, saveKey: "save" },
  { emoji: "💎", price: "¥299", color: C.accent, popular: false, saveKey: "savePro" },
];

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const [selected, setSelected] = useState(1);
  const plans = PLAN_KEYS.map((key, i) => ({
    ...PLAN_META[i],
    name: t(`plans.${key}.name`),
    nameEn: t(`plans.${key}.nameEn`),
    unit: t(`plans.${key}.unit`),
    desc: t(`plans.${key}.desc`),
    save: PLAN_META[i].saveKey ? t(PLAN_META[i].saveKey!) : null,
    features: t.raw(`plans.${key}.features`) as string[],
  }));

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
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              onClick={() => setSelected(i)}
              className={plan.popular ? "pricing-popular" : "card"}
              style={{
                padding: 28,
                borderRadius: 16,
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: plan.popular
                  ? undefined
                  : selected === i
                    ? `2px solid ${plan.color}40`
                    : `1.5px solid ${C.border}`,
                background: plan.popular ? undefined : C.surface,
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
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "Sora, sans-serif" }}>
                      {plan.nameEn}
                    </div>
                  </div>
                  <span style={{ fontSize: 24 }}>{plan.emoji}</span>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 42,
                      fontWeight: 800,
                      fontFamily: "Sora, sans-serif",
                      letterSpacing: "-1.5px",
                      color: C.textPrimary,
                    }}
                  >
                    {plan.price}
                  </span>
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
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "all 0.25s ease",
                  background: plan.popular ? C.brand : C.bgSubtle,
                  border: plan.popular ? "none" : `1.5px solid ${selected === i ? plan.color : C.border}`,
                  color: plan.popular ? "white" : selected === i ? plan.color : C.textSecondary,
                  boxShadow: plan.popular ? "var(--shadow-brand)" : "none",
                }}
              >
                {plan.popular ? t("buyNow") : t("selectPlan")}
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
          ))}
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
      </div>
    </section>
  );
}
