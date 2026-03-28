"use client";

import { useTranslations } from "next-intl";
import { C } from "./constants";

const FEATURE_KEYS = ["multiAgent", "chat", "visual", "format", "logic", "aitrace"] as const;
const COLORS = [C.brand, C.teal, C.accent, "#8B5CF6", "#0EA5E9", C.success];
const ICONS = ["🕵️", "💬", "📊", "📋", "🧠", "🔎"];

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" style={{ padding: "96px 32px", background: C.bgSubtle }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div className="badge badge-teal" style={{ marginBottom: 18 }}>
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
            {t("title")}
            <span className="gradient-text">{t("titleHighlight")}</span>
          </h2>
          <p style={{ fontSize: 17, color: C.textSecondary, maxWidth: 460, margin: "0 auto", lineHeight: 1.65 }}>
            {t("subtitle")}
          </p>
        </div>

        <div className="features-grid">
          {FEATURE_KEYS.map((key, i) => {
            const f = {
              icon: ICONS[i],
              color: COLORS[i],
              title: t(`items.${key}.title`),
              desc: t(`items.${key}.desc`),
              tags: t.raw(`items.${key}.tags`) as string[],
            };
            return (
            <div
              key={key}
              className="card-feature"
              style={{ padding: 28, background: C.surface, minWidth: 0 }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${f.color}10`,
                  border: `1px solid ${f.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginBottom: 18,
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.textPrimary,
                  letterSpacing: "-0.3px",
                  marginBottom: 10,
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, marginBottom: 18 }}>
                {f.desc}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: `${f.color}0E`,
                      border: `1px solid ${f.color}1A`,
                      color: f.color,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 100,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
