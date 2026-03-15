"use client";

import { useState } from "react";
import { C } from "./constants";

const FAQS = [
  {
    q: "支持哪些类型的论文？",
    a: "MVP 阶段专注于中文高校毕业论文（本科/硕士/博士），支持 PDF 格式上传，最大 150 页。后续版本将支持英文学位论文、期刊/会议论文。",
  },
  {
    q: "点数会过期吗？",
    a: "购买的点数永久有效，不设使用期限。你可以随时购买，随时使用，不会因长时间未使用而失效。",
  },
  {
    q: "我的论文内容会被泄露吗？",
    a: "所有上传文件均通过加密存储，传输过程使用 HTTPS 加密。LLM 日志系统会自动对个人敏感信息（PII）进行脱敏处理，绝不将论文内容用于训练或分享。",
  },
  {
    q: "AI 批阅失败了怎么办？",
    a: "系统配备自动重试机制（3 次指数退避）。若仍失败，任务自动转入人工复核通道并通知你预计处理时间。在此过程中，你的点数不会被扣除，直到成功出具报告为止。",
  },
  {
    q: "批阅报告可以导出吗？",
    a: "可以。批阅完成后支持下载 PDF 版（格式化报告）和 Markdown 版（结构化原文）两种格式，方便在 Word 或 Notion 中继续编辑。",
  },
  {
    q: "支持哪些支付方式？",
    a: "目前支持微信支付和支付宝（通过 Zpay 接入）。后续版本规划接入 Stripe / PayPal 国际支付。",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ padding: "96px 32px", background: C.bgSubtle }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge badge-teal" style={{ marginBottom: 18 }}>
            常见问题
          </div>
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              color: C.textPrimary,
              marginBottom: 10,
            }}
          >
            你可能想问的
          </h2>
          <p style={{ fontSize: 15, color: C.textMuted }}>遇到疑问？这里也许有你需要的答案</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                background: C.surface,
                border: `1.5px solid ${open === i ? "rgba(0,87,255,0.3)" : C.border}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "all 0.25s ease",
                boxShadow: open === i ? "var(--shadow-sm)" : "none",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{faq.q}</span>
                <span
                  style={{
                    color: open === i ? C.brand : C.textMuted,
                    fontSize: 20,
                    flexShrink: 0,
                    transition: "all 0.25s ease",
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div
                  style={{
                    padding: "0 22px 18px",
                    fontSize: 14,
                    color: C.textSecondary,
                    lineHeight: 1.75,
                    animation: "fade-up 0.2s ease-out",
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
