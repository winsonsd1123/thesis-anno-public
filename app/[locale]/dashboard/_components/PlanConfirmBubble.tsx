"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { StaticPlanStepId } from "@/lib/review/buildStaticPlan";
import type { ReviewPlanOptions } from "@/lib/types/review";

export type PlanStepRow = {
  id: StaticPlanStepId;
  label: string;
};

type PlanConfirmBubbleProps = {
  title: string;
  badge: string;
  steps: PlanStepRow[];
  planOptions: ReviewPlanOptions;
  /** pending 时可勾选；已开始后只读展示 */
  planEditable: boolean;
  onPlanChange: (next: ReviewPlanOptions) => void;
  /** 论文字数；有值时在步骤列表上方展示统计区 */
  wordCount?: number | null;
  /** pending 时展示预计扣点；与 creditsLoading / estimatedCredits 配合 */
  showCreditsEstimate?: boolean;
  creditsLoading?: boolean;
  estimatedCredits?: number | null;
  labelWordCount?: string;
  labelEstimatedCredits?: string;
  creditsLoadingText?: string;
  creditsValueText?: string;
  startLabel: string;
  startingLabel: string;
  /** false：仅展示计划列表（如批阅已启动），不显示开始按钮 */
  showStartButton?: boolean;
  /** 无开始按钮时底部一行说明，可选 */
  footerNote?: string;
  disabled?: boolean;
  onStart: () => Promise<void>;
  /** 勾选「格式」审阅时展示格式要求输入 */
  showFormatRequirements?: boolean;
  formatGuidelinesValue?: string;
  onFormatGuidelinesChange?: (value: string) => void;
  onImportDefaultFormat?: () => void | Promise<void>;
  formatRequirementsLabel?: string;
  formatRequirementsPlaceholder?: string;
  formatRequirementsHint?: string;
  importDefaultFormatLabel?: string;
  importDefaultFormatBusy?: boolean;
  importDefaultFormatBusyLabel?: string;
};

export function PlanConfirmBubble({
  title,
  badge,
  steps,
  planOptions,
  planEditable,
  onPlanChange,
  wordCount,
  showCreditsEstimate = false,
  creditsLoading = false,
  estimatedCredits,
  labelWordCount,
  labelEstimatedCredits,
  creditsLoadingText,
  creditsValueText,
  startLabel,
  startingLabel,
  showStartButton = true,
  footerNote,
  disabled,
  onStart,
  showFormatRequirements = false,
  formatGuidelinesValue = "",
  onFormatGuidelinesChange,
  onImportDefaultFormat,
  formatRequirementsLabel,
  formatRequirementsPlaceholder,
  formatRequirementsHint,
  importDefaultFormatLabel,
  importDefaultFormatBusy = false,
  importDefaultFormatBusyLabel,
}: PlanConfirmBubbleProps) {
  const [busy, setBusy] = useState(false);

  function toggleStep(id: StaticPlanStepId) {
    if (!planEditable) return;
    onPlanChange({ ...planOptions, [id]: !planOptions[id] });
  }

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

        {wordCount != null && wordCount > 0 ? (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{labelWordCount}</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                {wordCount.toLocaleString()}
              </span>
            </div>
            {showCreditsEstimate ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{labelEstimatedCredits}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                  {creditsLoading
                    ? (creditsLoadingText ?? "…")
                    : estimatedCredits != null
                      ? (creditsValueText ?? String(estimatedCredits))
                      : "—"}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {showFormatRequirements && onFormatGuidelinesChange ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {formatRequirementsLabel ?? "格式要求"}
              </span>
              {onImportDefaultFormat ? (
                <button
                  type="button"
                  disabled={disabled || importDefaultFormatBusy}
                  onClick={() => void onImportDefaultFormat()}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 12px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--brand)",
                    cursor: disabled || importDefaultFormatBusy ? "not-allowed" : "pointer",
                    opacity: disabled || importDefaultFormatBusy ? 0.5 : 1,
                  }}
                >
                  {importDefaultFormatBusy
                    ? (importDefaultFormatBusyLabel ?? "…")
                    : (importDefaultFormatLabel ?? "导入通用模板")}
                </button>
              ) : null}
            </div>
            {formatRequirementsHint ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{formatRequirementsHint}</p>
            ) : null}
            <textarea
              value={formatGuidelinesValue}
              onChange={(e) => onFormatGuidelinesChange(e.target.value)}
              disabled={disabled}
              rows={6}
              placeholder={formatRequirementsPlaceholder}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: 13,
                lineHeight: 1.55,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                resize: "vertical",
                minHeight: 120,
                fontFamily: "inherit",
              }}
            />
          </div>
        ) : null}

        {/* 计划条目（可勾选） */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {steps.map((step, i) => (
            <li
              key={step.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 14,
                color: "var(--text-primary)",
                lineHeight: 1.55,
                padding: "9px 0",
                borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: planEditable ? "pointer" : "default",
                  flex: 1,
                  margin: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={planOptions[step.id]}
                  disabled={!planEditable}
                  onChange={() => toggleStep(step.id)}
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 3,
                    flexShrink: 0,
                    accentColor: "var(--brand)",
                    cursor: planEditable ? "pointer" : "not-allowed",
                  }}
                />
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
                <span>{step.label}</span>
              </label>
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
