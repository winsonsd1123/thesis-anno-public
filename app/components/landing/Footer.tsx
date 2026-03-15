"use client";

import { C } from "./constants";

const FOOTER_LINKS = [
  { title: "产品", links: ["功能介绍", "工作流程", "价格套餐", "示例报告"] },
  { title: "资源", links: ["使用文档", "批阅标准", "更新日志", "API 文档"] },
  { title: "关于", links: ["关于我们", "联系我们", "隐私政策", "服务条款"] },
];

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "48px 32px 32px", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="footer-grid" style={{ marginBottom: 44 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${C.brand}, ${C.teal})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontFamily: "Sora, sans-serif",
                  fontWeight: 800,
                  fontSize: 16,
                  color: C.textPrimary,
                }}
              >
                ThesisAI
              </span>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, maxWidth: 260 }}>
              AI 驱动的论文智能批阅平台。多智能体协作，导师级预审，帮你在答辩前发现并修正问题。
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textMuted,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                {col.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    style={{
                      fontSize: 13,
                      color: C.textSecondary,
                      textDecoration: "none",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = C.brand)}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = C.textSecondary)}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="divider" style={{ marginBottom: 22 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>© 2026 ThesisAI. 保留所有权利。</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["微信公众号", "小红书", "知乎"].map((p) => (
              <a
                key={p}
                href="#"
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = C.brand)}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = C.textMuted)}
              >
                {p}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
