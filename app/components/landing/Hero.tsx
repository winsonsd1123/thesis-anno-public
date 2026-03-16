"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { C } from "./constants";
import { HeroPreview } from "./HeroPreview";

export function Hero() {
  const t = useTranslations("landing.hero");
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    const fullText = t("typedText");
    let i = 0;
    const id = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i++));
      } else clearInterval(id);
    }, 90);
    return () => clearInterval(id);
  }, [t]);

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "110px 32px 80px",
        position: "relative",
        overflow: "hidden",
        background: C.bg,
      }}
    >
      <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.7, pointerEvents: "none" }} />
      <div className="noise" />
      <div
        className="hero-blob"
        style={{
          width: 600,
          height: 600,
          background: "rgba(0,87,255,0.06)",
          top: -200,
          left: -100,
        }}
      />
      <div
        className="hero-blob"
        style={{
          width: 400,
          height: 400,
          background: "rgba(0,180,166,0.07)",
          bottom: -100,
          right: 0,
        }}
      />
      <div
        className="hero-blob"
        style={{
          width: 250,
          height: 250,
          background: "rgba(255,107,53,0.05)",
          top: "30%",
          right: "20%",
        }}
      />

      <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="hero-grid">
          <div className="hero-text">
            <div
              className="badge badge-brand"
              style={{ marginBottom: 28, opacity: 0, animation: "fade-up 0.5s ease-out 0.05s forwards" }}
            >
              <span className="status-dot running" style={{ width: 6, height: 6 }} />
              {t("badge")}
            </div>

            <h1
              style={{
                fontSize: "clamp(38px, 5vw, 60px)",
                fontWeight: 800,
                letterSpacing: "-1.8px",
                color: C.textPrimary,
                marginBottom: 20,
                opacity: 0,
                animation: "fade-up 0.55s ease-out 0.1s forwards",
              }}
            >
              {t("title1")}
              <br />
              <span className="gradient-text">{t("title2")}</span>
              <br />
              {t("title3")}
            </h1>

            <p
              style={{
                fontSize: 18,
                color: C.textSecondary,
                lineHeight: 1.7,
                maxWidth: 440,
                marginBottom: 36,
                opacity: 0,
                animation: "fade-up 0.55s ease-out 0.18s forwards",
              }}
            >
              {t("subtitle")}
            </p>

            <div
              className="hero-stats"
              style={{
                display: "flex",
                gap: 36,
                marginBottom: 36,
                paddingBottom: 32,
                borderBottom: `1px solid ${C.border}`,
                opacity: 0,
                animation: "fade-up 0.55s ease-out 0.26s forwards",
              }}
            >
              {[
                { num: t("stat1"), label: t("stat1Label") },
                { num: t("stat2"), label: t("stat2Label") },
                { num: t("stat3"), label: t("stat3Label") },
              ].map((s) => (
                <div key={s.num + s.label}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "Sora, sans-serif",
                      color: C.textPrimary,
                      letterSpacing: "-0.5px",
                      marginBottom: 2,
                    }}
                  >
                    {s.num}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div
              className="hero-cta"
              style={{
                display: "flex",
                gap: 12,
                opacity: 0,
                animation: "fade-up 0.55s ease-out 0.34s forwards",
              }}
            >
              <button className="btn-primary" style={{ padding: "14px 28px", fontSize: 15 }}>
                {t("ctaPrimary")}
                <span style={{ fontSize: 17 }}>→</span>
              </button>
              <button className="btn-secondary" style={{ padding: "14px 22px", fontSize: 15 }}>
                <span>▶</span> {t("ctaSecondary")}
              </button>
            </div>

            <div
              className="hero-trust"
              style={{
                marginTop: 20,
                display: "flex",
                gap: 20,
                opacity: 0,
                animation: "fade-up 0.55s ease-out 0.42s forwards",
              }}
            >
              {[t("trust1"), t("trust2"), t("trust3")].map((txt) => (
                <span key={txt} style={{ fontSize: 12, color: C.textMuted }}>
                  {txt}
                </span>
              ))}
            </div>
          </div>

          <div
            className="hero-preview-wrap"
            style={{ opacity: 0, animation: "fade-up 0.65s ease-out 0.2s forwards" }}
          >
            <HeroPreview typedText={typedText} />
          </div>
        </div>
      </div>
    </section>
  );
}
