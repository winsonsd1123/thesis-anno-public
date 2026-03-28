"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReviewResult } from "@/lib/types/review";
import { REPORT_ISSUE_TYPE_KEYS } from "@/lib/review/report-issue-types";
import { reviewResultToMarkdown, type ReviewMarkdownLabels } from "@/lib/review/review-result-markdown";
import { ReportStructuredBody } from "./ReportStructuredBody";

type ReportViewerProps = {
  tabStructure: string;
  tabLogic: string;
  tabAiTrace: string;
  tabRefs: string;
  placeholder: string;
  emptySection: string;
  exportLabel: string;
  result: ReviewResult | null;
  /** 用于导出 Markdown 文件名（去掉扩展名后拼接 `-review-report.md`） */
  exportFileStem?: string | null;
  /** 为 true 时显示「原始 JSON」切换（仅管理员） */
  allowRawJson?: boolean;
  /** 已退款 agent → 退款积分映射；有值时在对应失败 Tab 顶部展示退款通知 */
  agentRefunds?: Partial<Record<string, number>>;
};

function buildMarkdownFilename(stem: string | null | undefined): string {
  const raw = (stem ?? "").trim().replace(/\.[^/.]+$/i, "");
  const safe = raw
    .replace(/[^\w\u4e00-\u9fff\-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const base = (safe || "thesis-review").slice(0, 72);
  return `${base}-review-report.md`;
}

const TAB_TO_AGENT: Record<string, string> = {
  structure: "format",
  logic: "logic",
  aitrace: "aitrace",
  refs: "reference",
};

export function ReportViewer({
  tabStructure,
  tabLogic,
  tabAiTrace,
  tabRefs,
  placeholder,
  emptySection,
  exportLabel,
  result,
  exportFileStem = null,
  allowRawJson = false,
  agentRefunds,
}: ReportViewerProps) {
  const t = useTranslations("dashboard.review");
  const [tab, setTab] = useState<"structure" | "logic" | "aitrace" | "refs">("structure");
  const [showRaw, setShowRaw] = useState(false);

  const rawEnabled = allowRawJson && !!result;
  const displayRaw = rawEnabled && showRaw;

  const mdLabels: ReviewMarkdownLabels = useMemo(
    () => ({
      documentTitle: t("exportMdTitle"),
      generatedPrefix: t("exportMdGenerated"),
      sectionFormat: tabStructure,
      sectionLogic: tabLogic,
      sectionAiTrace: tabAiTrace,
      sectionRefs: tabRefs,
      empty: emptySection,
      skipped: t("reportSkipped"),
      errorHeading: t("reportErrorTitle"),
      noIssues: t("reportNoIssuesTitle"),
      severityHigh: t("reportSeverityHigh"),
      severityMedium: t("reportSeverityMedium"),
      severityLow: t("reportSeverityLow"),
      fieldSeverity: t("exportMdFieldSeverity"),
      fieldLocation: t("exportMdFieldLocation"),
      fieldQuote: t("exportMdQuote"),
      fieldAnalysis: t("reportAnalysis"),
      fieldSuggestion: t("reportSuggestion"),
      metricsHeader: t("exportMdMetricsHeader"),
      metricSemanticIssues: t("reportMetricSemanticIssues"),
      metricPhysicalIssues: t("reportMetricPhysicalIssues"),
      metricBaseline: t("reportMetricBaseline"),
      metricExtractOk: t("reportMetricExtractOk"),
      metricTiming: t("reportMetricTiming"),
      metricPass1: t("reportMetricPass1"),
      metricPass2: t("reportMetricPass2"),
      metricMerged: t("reportMetricMerged"),
      metricTotalIssues: t("reportMetricTotalIssues"),
      metricDurationSeconds: t("reportMetricDurationSeconds"),
      yes: t("reportYes"),
      no: t("reportNo"),
      refReason: t("reportRefReason"),
      refStandard: t("reportRefStandardHint"),
      refCandidate: t("reportRefCandidate"),
      refYear: t("reportRefYear"),
      refAuthors: t("exportMdRefAuthors"),
      refRaw: t("exportMdRefRaw"),
      refLabelFact: t("exportMdRefFact"),
      refLabelFormat: t("exportMdRefFormat"),
      refsEmpty: t("reportRefsEmptyTitle"),
      translateIssueType: (code: string) => {
        const safe = code.trim() || "unknown";
        if (REPORT_ISSUE_TYPE_KEYS.has(safe)) {
          return t(`reportIssueType_${safe}` as never);
        }
        return t("reportIssueType_other", { type: safe });
      },
      translateRefFact: (fact: string) => {
        if (fact === "real") return t("reportRefFact_real");
        if (fact === "fake_or_not_found") return t("reportRefFact_fake");
        if (fact === "suspected") return t("reportRefFact_suspected");
        return fact || "—";
      },
      translateRefFormat: (fmt: string) => {
        if (fmt === "standard") return t("reportRefFmt_standard");
        if (fmt === "unstandard") return t("reportRefFmt_unstandard");
        return fmt || "—";
      },
    }),
    [t, tabStructure, tabLogic, tabAiTrace, tabRefs, emptySection]
  );

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "structure", label: tabStructure },
    { id: "logic", label: tabLogic },
    { id: "aitrace", label: tabAiTrace },
    { id: "refs", label: tabRefs },
  ];

  const activePayload = useMemo(() => {
    if (!result) return null;
    if (tab === "structure") return result.format_result;
    if (tab === "logic") return result.logic_result;
    if (tab === "aitrace") return result.aitrace_result;
    return result.reference_result;
  }, [result, tab]);

  const rawBody = useMemo(() => {
    if (!result) return placeholder;
    if (activePayload === undefined || activePayload === null) return emptySection;
    return JSON.stringify(activePayload, null, 2);
  }, [result, activePayload, placeholder, emptySection]);

  function handleExportMarkdown() {
    if (!result) return;
    const md = reviewResultToMarkdown(result, mdLabels);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildMarkdownFilename(exportFileStem);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        maxWidth: 720,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, var(--brand) 0%, var(--teal) 50%, var(--accent) 100%)",
          opacity: 0.85,
        }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "14px 14px 12px",
          paddingTop: 16,
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--bg-subtle) 0%, var(--surface) 100%)",
        }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: tab === tb.id ? "var(--surface)" : "transparent",
              color: tab === tb.id ? "var(--brand)" : "var(--text-secondary)",
              boxShadow: tab === tb.id ? "var(--shadow-sm)" : "none",
              transition: "color 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {tb.label}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 12 }} />
        {rawEnabled ? (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: showRaw ? "var(--brand-bg)" : "var(--surface)",
              color: showRaw ? "var(--brand-dark)" : "var(--text-secondary)",
            }}
          >
            {showRaw ? t("reportHideRaw") : t("reportShowRaw")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!result}
          onClick={handleExportMarkdown}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            cursor: result ? "pointer" : "not-allowed",
            background: "var(--surface)",
            color: result ? "var(--text-primary)" : "var(--text-muted)",
            opacity: result ? 1 : 0.55,
          }}
        >
          {exportLabel}
        </button>
      </div>
      <div
        style={{
          padding: "24px 26px 28px",
          minHeight: 200,
          overflowX: "hidden",
          overflowY: "visible",
          background: "linear-gradient(165deg, var(--surface) 0%, var(--bg-subtle) 38%, var(--surface) 92%)",
        }}
      >
        {!result ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>{placeholder}</p>
        ) : displayRaw ? (
          <pre
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {rawBody}
          </pre>
        ) : (
          <>
            {(() => {
              const agent = TAB_TO_AGENT[tab];
              const refundAmount = agent ? agentRefunds?.[agent] : undefined;
              const hasError = activePayload != null && typeof activePayload === "object" && "error" in activePayload;
              if (!hasError || !refundAmount) return null;
              return (
                <div
                  role="status"
                  style={{
                    marginBottom: 18,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid var(--warning, #f59e0b)",
                    background: "rgba(245, 158, 11, 0.08)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--warning-text, #92400e)",
                    lineHeight: 1.55,
                  }}
                >
                  {t("reportModuleRefundNotice", { credits: refundAmount })}
                </div>
              );
            })()}
            <ReportStructuredBody tab={tab} value={activePayload} emptyLabel={emptySection} />
          </>
        )}
      </div>
    </div>
  );
}
