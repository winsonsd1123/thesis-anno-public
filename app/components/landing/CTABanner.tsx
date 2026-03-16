"use client";

import { useTranslations } from "next-intl";
import { C } from "./constants";

export function CTABanner() {
  const t = useTranslations("landing.ctaBanner");

  return (
    <section style={{ padding: "60px 32px 96px", background: C.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${C.bgSubtle} 0%, rgba(0,180,166,0.06) 100%)`,
            border: `2px solid ${C.border}`,
            borderRadius: 24,
            padding: "60px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: `${C.brand}08`,
              border: `1px solid ${C.brand}12`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -40,
              left: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `${C.accent}06`,
              border: `1px solid ${C.accent}10`,
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🚀</div>
            <h2
              style={{
                fontSize: "clamp(24px, 4vw, 42px)",
                fontWeight: 800,
                letterSpacing: "-1.2px",
                color: C.textPrimary,
                marginBottom: 14,
                lineHeight: 1.15,
              }}
            >
              {t("title1")}
              <br />
              <span className="gradient-text">{t("title2")}</span>
            </h2>
            <p
              style={{
                fontSize: 17,
                color: C.textSecondary,
                maxWidth: 420,
                margin: "0 auto 36px",
                lineHeight: 1.65,
              }}
            >
              {t("subtitle")}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-primary" style={{ padding: "15px 36px", fontSize: 16, borderRadius: 12 }}>
                {t("ctaPrimary")}
                <span style={{ fontSize: 18 }}>→</span>
              </button>
              <button className="btn-secondary" style={{ padding: "15px 28px", fontSize: 15, borderRadius: 12 }}>
                {t("ctaSecondary")}
              </button>
            </div>

            <div
              style={{
                marginTop: 28,
                display: "flex",
                justifyContent: "center",
                gap: 28,
                flexWrap: "wrap",
              }}
            >
              {[t("trust1"), t("trust2"), t("trust3")].map((item) => (
                <span key={item} style={{ fontSize: 13, color: C.textMuted }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
