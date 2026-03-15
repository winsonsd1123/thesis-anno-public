"use client";

import { C } from "./constants";

const STATS = [
  { num: "5,000+", label: "已处理论文", icon: "📄" },
  { num: "98%", label: "用户满意度", icon: "⭐" },
  { num: "< 5min", label: "平均批阅", icon: "⚡" },
  { num: "GB/T", label: "国家标准", icon: "🏆" },
];

const TESTIMONIALS = [
  {
    avatar: "🎓",
    name: "王同学",
    school: "华中科技大学 · 硕士",
    text: "用 ThesisAI 检查了我的毕业论文，帮我找出了英文摘要里几处 Chinglish 和参考文献格式问题，比自己逐字检查省了好多时间！",
  },
  {
    avatar: "🔬",
    name: "陈同学",
    school: "北京大学 · 博士",
    text: "逻辑分析功能特别强，能帮我梳理出第三章论证链中一个我自己都没发现的逻辑漏洞。答辩前用这个真的很有安全感。",
  },
  {
    avatar: "📚",
    name: "李同学",
    school: "浙江大学 · 本科",
    text: "对话式的交互体验太好了，上传完 PDF 后 AI 会主动问你关注哪方面，完全不像填表格那么枯燥。报告也非常详细！",
  },
];

export function SocialProof() {
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
          {STATS.map((s) => (
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
            同学们都在用 <span className="gradient-text">ThesisAI</span>
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted }}>来自真实用户的反馈</p>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="card" style={{ padding: 24, background: C.surface }}>
              <div style={{ fontSize: 32, color: C.accent, marginBottom: 14, lineHeight: 1 }}>❝</div>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>{t.text}</p>
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
                  {t.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{t.school}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
