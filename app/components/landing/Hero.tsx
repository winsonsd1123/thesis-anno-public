"use client";

import { useState, useEffect } from "react";
import { C } from "./constants";
import { HeroPreview } from "./HeroPreview";

export function Hero() {
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    const fullText = "基于深度学习的图像识别研究";
    let i = 0;
    const t = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i++));
      } else clearInterval(t);
    }, 90);
    return () => clearInterval(t);
  }, []);

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
              多智能体 AI 批阅系统 · MVP 上线
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
              导师级 AI
              <br />
              <span className="gradient-text">为你的论文</span>
              <br />
              保驾护航
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
              多智能体协作批阅，格式规范、内容逻辑、参考文献三维并行审查，
              5 分钟内出具「导师级」预审报告。
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
                { num: "< 5min", label: "完整批阅" },
                { num: "5 维度", label: "全方位检查" },
                { num: "GB/T", label: "国家标准" },
              ].map((s) => (
                <div key={s.label}>
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
                立即免费体验
                <span style={{ fontSize: 17 }}>→</span>
              </button>
              <button className="btn-secondary" style={{ padding: "14px 22px", fontSize: 15 }}>
                <span>▶</span> 查看演示
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
              {["✓ 无需绑卡", "✓ 首次免费", "✓ 点数永久有效"].map((t) => (
                <span key={t} style={{ fontSize: 12, color: C.textMuted }}>
                  {t}
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
