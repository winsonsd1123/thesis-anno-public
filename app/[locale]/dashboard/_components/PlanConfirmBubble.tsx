"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type PlanConfirmBubbleProps = {
  title: string;
  badge: string;
  items: string[];
  startLabel: string;
  startingLabel: string;
  /** false：仅展示计划列表（如批阅已启动），不显示开始按钮 */
  showStartButton?: boolean;
  /** 无开始按钮时底部一行说明，可选 */
  footerNote?: string;
  disabled?: boolean;
  onStart: () => Promise<void>;
};

export function PlanConfirmBubble({
  title,
  badge,
  items,
  startLabel,
  startingLabel,
  showStartButton = true,
  footerNote,
  disabled,
  onStart,
}: PlanConfirmBubbleProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await onStart();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        maxWidth: 520,
      }}
    >
      {/* 顶部品牌色渐变条 */}
      <div
        style={{
          height: 3,
          background: "linear-gradient(90deg, var(--brand) 0%, var(--teal) 100%)",
        }}
        aria-hidden
      />

      <div style={{ padding: "16px 18px 18px" }}>
        {/* 标题行 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {title}
          </span>
          {badge ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 9px",
                borderRadius: 999,
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                whiteSpace: "nowrap",
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        {/* 计划条目 */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 14,
                color: "var(--text-primary)",
                lineHeight: 1.55,
                padding: "9px 0",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--brand-bg)",
                  color: "var(--brand)",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* 操作行：仅待开始时显示按钮；进行中可显示说明 */}
        {showStartButton ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingTop: 14,
              marginTop: 4,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              disabled={disabled || busy}
              onClick={handleClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                cursor: disabled || busy ? "not-allowed" : "pointer",
                opacity: disabled || busy ? 0.45 : 1,
                background: disabled || busy ? "var(--bg-muted)" : "var(--brand)",
                color: disabled || busy ? "var(--text-secondary)" : "#fff",
                boxShadow: disabled || busy ? "none" : "0 4px 14px rgba(0,87,255,0.30)",
                transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              <Play size={12} strokeWidth={2.5} aria-hidden style={{ marginLeft: -1 }} />
              {busy ? startingLabel : startLabel}
            </button>
          </div>
        ) : footerNote ? (
          <div
            style={{
              paddingTop: 14,
              marginTop: 4,
              borderTop: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {footerNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}
