"use client";

import { useTranslations } from "next-intl";
import { C } from "./constants";

const STAT_ICONS = ["📄", "⭐", "⚡", "🏆"];


export function SocialProof() {
  const t = useTranslations("landing.socialProof");
  const stats = (t.raw("stats") as Array<{ num: string; label: string }>).map((s, i) => ({
    ...s,
    icon: STAT_ICONS[i],
  }));
  const testimonials = t.raw("testimonials") as Array<{ name: string; school: string; text: string }>;

  return (
    <section style={{ padding: "80px 32px", background: C.bgSubtle }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          className="stats-grid"
          style={{
            background: C.border,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 72,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ background: C.surface, padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
              <div
                className="shimmer-text"
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  fontFamily: "Sora, sans-serif",
                  letterSpacing: "-1px",
                  marginBottom: 6,
                }}
              >
                {s.num}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              color: C.textPrimary,
              marginBottom: 10,
            }}
          >
            {t("title")} <span className="gradient-text">{t("titleHighlight")}</span>
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted }}>{t("subtitle")}</p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((item, i) => (
            <div key={i} className="card" style={{ padding: 24, background: C.surface }}>
              <div style={{ fontSize: 32, color: C.accent, marginBottom: 14, lineHeight: 1 }}>❝</div>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>{item.text}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: C.brandBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  {["🎓", "🔬", "📚"][i]}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{item.school}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
