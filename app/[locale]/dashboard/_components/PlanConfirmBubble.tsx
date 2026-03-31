"use client";

import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";

import { EmbeddedObjectTip } from "./EmbeddedObjectTip";
import type { StaticPlanStepId } from "@/lib/review/buildStaticPlan";
import type { ReviewPlanOptions } from "@/lib/types/review";

const STARTING_HINTS = [
  "正在验证账户信息…",
  "正在处理积分扣费…",
  "正在派发审阅任务…",
  "即将完成，请稍候…",
] as const;

export type PlanStepRow = {
  id: StaticPlanStepId;
  label: string;
};

type PlanConfirmBubbleProps = {
  title: string;
  badge: string;
  /** 领域标签前的说明，如「论文领域：」 */
  domainBadgePrefix?: string;
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
  /** 字数统计口径说明，如「全文估算」 */
  wordCountScopeHint?: string;
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
  /** 计划只读时（已启动/已结束）在 checklist 上方的总括说明 */
  planScopeSummary?: string;
  /** Visio 等内置对象提示：另存为图片再插入 */
  embeddedObjectTip?: string;
  /** 每个已选模块的积分消耗，来自 cost_breakdown，勾选项右侧展示 "+N 积分" */
  stepCosts?: Partial<Record<StaticPlanStepId, number>>;
  /** 余额不足标志：true 时在统计区展示警示并禁用开始按钮 */
  insufficientCredits?: boolean;
  /** 积分不足提示文案 */
  insufficientCreditsHint?: string;
  /** 充值页路径，供积分不足提示中的链接使用 */
  rechargeHref?: string;
};

export function PlanConfirmBubble({
  title,
  badge,
  domainBadgePrefix,
  steps,
  planOptions,
  planEditable,
  onPlanChange,
  wordCount,
  showCreditsEstimate = false,
  creditsLoading = false,
  estimatedCredits,
  labelWordCount,
  wordCountScopeHint,
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
  planScopeSummary,
  embeddedObjectTip,
  stepCosts,
  insufficientCredits = false,
  insufficientCreditsHint,
  rechargeHref,
}: PlanConfirmBubbleProps) {
  const [busy, setBusy] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    if (!busy) {
      setHintIndex(0);
      return;
    }
    const id = setInterval(() => {
      setHintIndex((prev) => Math.min(prev + 1, STARTING_HINTS.length - 1));
    }, 3000);
    return () => clearInterval(id);
  }, [busy]);

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                maxWidth: "min(100%, 280px)",
                justifyContent: "flex-end",
              }}
            >
              {domainBadgePrefix ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {domainBadgePrefix}
                </span>
              ) : null}
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
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {badge}
              </span>
            </div>
          ) : null}
        </div>

        {embeddedObjectTip ? (
          <div style={{ marginBottom: 14 }}>
            <EmbeddedObjectTip text={embeddedObjectTip} />
          </div>
        ) : null}

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
            {wordCountScopeHint ? (
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>{wordCountScopeHint}</p>
            ) : null}
            {showCreditsEstimate ? (
              <>
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
                  <span style={{ fontWeight: 600, color: insufficientCredits ? "var(--danger)" : "var(--text-primary)", textAlign: "right" }}>
                    {creditsLoading
                      ? (creditsLoadingText ?? "…")
                      : estimatedCredits != null
                        ? (creditsValueText ?? String(estimatedCredits))
                        : "—"}
                  </span>
                </div>
                {insufficientCredits && insufficientCreditsHint ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--danger)",
                    }}
                  >
                    <span>{insufficientCreditsHint}</span>
                    {rechargeHref ? (
                      <a
                        href={rechargeHref}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--brand)",
                          textDecoration: "underline",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        →
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </>
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

        {planScopeSummary && !planEditable ? (
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {planScopeSummary}
          </p>
        ) : null}

        {/* 计划条目（可勾选） */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {steps.map((step, i) => (
            <li
              key={step.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0,
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
                <span style={{ flex: 1 }}>{step.label}</span>
                {planOptions[step.id] && stepCosts?.[step.id] != null ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--brand)",
                      background: "var(--brand-bg)",
                      padding: "2px 7px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      alignSelf: "center",
                    }}
                  >
                    +{stepCosts[step.id]}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>

        {/* 操作行：仅待开始时显示按钮；进行中可显示说明 */}
        {showStartButton ? (
          <div
            style={{
              paddingTop: 14,
              marginTop: 4,
              borderTop: "1px solid var(--border)",
            }}
          >
            <style>{`@keyframes _spin{to{transform:rotate(360deg)}} @keyframes _fadein{from{opacity:0}to{opacity:1}}`}</style>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={disabled || busy || insufficientCredits}
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
                  cursor: disabled || busy || insufficientCredits ? "not-allowed" : "pointer",
                  opacity: disabled || busy || insufficientCredits ? 0.45 : 1,
                  background: disabled || busy || insufficientCredits ? "var(--bg-muted)" : "var(--brand)",
                  color: disabled || busy || insufficientCredits ? "var(--text-secondary)" : "#fff",
                  boxShadow: disabled || busy || insufficientCredits ? "none" : "0 4px 14px rgba(0,87,255,0.30)",
                  transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {busy ? (
                  <Loader2
                    size={12}
                    strokeWidth={2.5}
                    aria-hidden
                    style={{ marginLeft: -1, animation: "_spin 1s linear infinite" }}
                  />
                ) : (
                  <Play size={12} strokeWidth={2.5} aria-hidden style={{ marginLeft: -1 }} />
                )}
                {busy ? startingLabel : startLabel}
              </button>
            </div>
            {busy ? (
              <p
                key={hintIndex}
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "right",
                  lineHeight: 1.5,
                  animation: "_fadein 0.3s ease",
                }}
              >
                {STARTING_HINTS[hintIndex]}
              </p>
            ) : null}
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
