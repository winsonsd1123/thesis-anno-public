"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { C } from "./constants";

const STEP_KEYS = ["upload", "chat", "parallel", "report"] as const;
const STEP_COLORS = [C.brand, C.teal, C.accent, C.success];
const STEP_ICONS = ["📤", "💬", "🚀", "📊"];

function ResultPreview({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = t.raw("preview.tabs") as string[];

  const issues = [
    {
      level: "高",
      color: C.danger,
      text: "第三章 3.3 节数据分析逻辑存在循环论证，建议重新梳理推理链。",
      page: "P.42",
    },
    {
      level: "中",
      color: C.warning,
      text: "英文摘要第二句存在 Chinglish：「make the experiment」建议替换为「conduct the experiment」。",
      page: "P.3",
    },
    {
      level: "中",
      color: C.warning,
      text: "参考文献 [12] 格式不符合 GB/T 7714-2015，缺少出版年份。",
      page: "P.78",
    },
    {
      level: "低",
      color: C.teal,
      text: "图 2-3 与正文「如图 2-4 所示」引用不一致，请核查编号。",
      page: "P.28",
    },
  ];

  const scores = [
    { label: "格式规范", score: 92, color: C.brand },
    { label: "内容逻辑", score: 85, color: C.teal },
    { label: "参考文献", score: 78, color: C.accent },
    { label: "语言表达", score: 89, color: C.success },
  ];

  return (
    <div
      style={{
        marginTop: 72,
        border: `1.5px solid ${C.border}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(15,23,42,0.09)",
        background: C.surface,
      }}
    >
      <div
        style={{
          background: C.bgSubtle,
          borderBottom: `1px solid ${C.border}`,
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FE5F57", display: "inline-block" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E", display: "inline-block" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 10, fontSize: 12, color: C.textMuted, fontFamily: "Sora, sans-serif" }}>
          {t("preview.title")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            style={{
              background: C.brand,
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("preview.downloadPdf")}
          </button>
          <button
            style={{
              background: C.bgMuted,
              color: C.textSecondary,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t("preview.downloadMd")}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${C.border}`,
          padding: "0 4px",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "13px 20px",
              fontSize: 13,
              fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? C.brand : C.textMuted,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === i ? `2px solid ${C.brand}` : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="result-grid" style={{ padding: 28 }}>
        <div>
          <div
            style={{
              background: "linear-gradient(145deg, #EFF4FF, #F0FFFE)",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "20px 16px",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                fontFamily: "Sora, sans-serif",
                letterSpacing: "-2px",
                lineHeight: 1,
                marginBottom: 6,
              }}
              className="gradient-text"
            >
              87
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{t("preview.overallScore")}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scores.map((item) => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: C.textSecondary }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: C.textPrimary, fontWeight: 600 }}>{item.score}</span>
                </div>
                <div style={{ height: 5, background: C.bgMuted, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${item.score}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("preview.coreIssues")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {issues.map((issue, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "12px 14px",
                  background: C.bgSubtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${issue.color}30`;
                  (e.currentTarget as HTMLElement).style.background = `${issue.color}05`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLElement).style.background = C.bgSubtle;
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    background: `${issue.color}12`,
                    color: issue.color,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 5,
                    marginTop: 1,
                    letterSpacing: "0.3px",
                  }}
                >
                  {issue.level}
                </span>
                <span style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55, flex: 1 }}>
                  {issue.text}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    color: C.textMuted,
                    fontFamily: "Sora, sans-serif",
                    background: C.bgMuted,
                    padding: "2px 8px",
                    borderRadius: 5,
                    marginTop: 1,
                  }}
                >
                  {issue.page}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("landing.howItWorks");
  const steps = STEP_KEYS.map((key, i) => ({
    num: i + 1,
    icon: STEP_ICONS[i],
    color: STEP_COLORS[i],
    title: t(`steps.${key}.title`),
    desc: t(`steps.${key}.desc`),
    tag: t(`steps.${key}.tag`),
  }));

  return (
    <section id="workflow" style={{ padding: "96px 32px", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div className="badge badge-brand" style={{ marginBottom: 18 }}>
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
            {t("title")}<span className="gradient-text">{t("titleHighlight")}</span>
          </h2>
          <p style={{ fontSize: 17, color: C.textSecondary, maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>
            {t("subtitle")}
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <div className="workflow-connector" />
          <div className="workflow-grid" style={{ position: "relative", zIndex: 1 }}>
            {steps.map((step) => (
              <div
                key={step.num}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: `${step.color}0E`,
                    border: `2px solid ${step.color}25`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    marginBottom: 24,
                    position: "relative",
                    transition: "all 0.3s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background = `${step.color}18`;
                    el.style.borderColor = `${step.color}50`;
                    el.style.boxShadow = `0 8px 24px ${step.color}25`;
                    el.style.transform = "scale(1.06)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background = `${step.color}0E`;
                    el.style.borderColor = `${step.color}25`;
                    el.style.boxShadow = "none";
                    el.style.transform = "scale(1)";
                  }}
                >
                  {step.icon}
                  <span
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: step.color,
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "Sora, sans-serif",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 2px 8px ${step.color}40`,
                    }}
                  >
                    {step.num}
                  </span>
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
                  {step.desc}
                </p>
                <span
                  style={{
                    background: `${step.color}0E`,
                    border: `1px solid ${step.color}1A`,
                    color: step.color,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 14px",
                    borderRadius: 100,
                  }}
                >
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ResultPreview t={t} />
      </div>
    </section>
  );
}
