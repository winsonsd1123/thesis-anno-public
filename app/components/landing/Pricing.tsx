"use client";

import { useState } from "react";
import { C } from "./constants";

const PLANS = [
  {
    name: "单次体验",
    nameEn: "Single Pass",
    emoji: "⚡",
    price: "¥9.9",
    unit: "1 次",
    desc: "适合初次体验，感受 AI 批阅的效果",
    color: C.brand,
    popular: false,
    save: null as string | null,
    features: [
      "1 次完整论文批阅",
      "五维度审阅报告",
      "PDF 报告下载",
      "< 60 页论文",
      "基础客服支持",
    ],
  },
  {
    name: "标准套餐",
    nameEn: "Standard Bundle",
    emoji: "🔥",
    price: "¥79",
    unit: "10 次",
    desc: "最受欢迎，适合毕业季多次修改迭代",
    color: C.brand,
    popular: true,
    save: "节省 20%",
    features: [
      "10 次完整论文批阅",
      "五维度审阅报告",
      "PDF + Markdown 下载",
      "支持 100 页以内论文",
      "优先处理队列",
      "完整历史记录",
    ],
  },
  {
    name: "专业套餐",
    nameEn: "Pro Bundle",
    emoji: "💎",
    price: "¥299",
    unit: "50 次",
    desc: "适合导师、研究团队或机构批量使用",
    color: C.accent,
    popular: false,
    save: "节省 40%",
    features: [
      "50 次完整论文批阅",
      "五维度审阅报告",
      "PDF + Markdown 下载",
      "支持 150 页以内论文",
      "最高优先级队列",
      "完整历史记录与导出",
      "专属客服工单",
    ],
  },
];

export function Pricing() {
  const [selected, setSelected] = useState(1);

  return (
    <section id="pricing" style={{ padding: "96px 32px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge badge-accent" style={{ marginBottom: 18 }}>
            点数套餐
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
            透明定价，<span className="gradient-text-warm">按需购买</span>
          </h2>
          <p style={{ fontSize: 17, color: C.textSecondary, maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>
            预付费点数制，无月费，无订阅束缚。购买即用，点数永久有效。
          </p>
        </div>

        <div className="pricing-grid" style={{ alignItems: "stretch" }}>
          {PLANS.map((plan, i) => (
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
                  最受欢迎
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
                {plan.popular ? "立即购买 →" : "选择此套餐"}
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
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>消耗规则：</span>
          {[
            { pages: "< 60页", cost: "消耗 1 次", color: C.brand },
            { pages: "60 ~ 100页", cost: "消耗 2 次", color: C.teal },
            { pages: "100 ~ 150页", cost: "消耗 3 次", color: C.accent },
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
