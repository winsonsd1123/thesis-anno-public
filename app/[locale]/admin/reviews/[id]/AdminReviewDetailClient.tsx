"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { ReportViewer } from "@/app/[locale]/dashboard/_components/ReportViewer";
import { REPORT_ISSUE_TYPE_KEYS } from "@/lib/review/report-issue-types";
import { reviewResultToMarkdown, type ReviewMarkdownLabels } from "@/lib/review/review-result-markdown";
import type { ReviewResult } from "@/lib/types/review";

export type AdminReviewDetailPayload = {
  id: number;
  file_name: string | null;
  status: string;
  completed_at: string | null;
  updated_at: string;
  user_email: string;
  result: ReviewResult | null;
};

const STATUS_KEYS = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "needs_manual_review",
  "refunded",
] as const;

function isReviewStatus(s: string): s is (typeof STATUS_KEYS)[number] {
  return (STATUS_KEYS as readonly string[]).includes(s);
}

export function AdminReviewDetailClient({ review }: { review: AdminReviewDetailPayload }) {
  const ta = useTranslations("admin.reviews");
  const t = useTranslations("dashboard.review");
  const format = useFormatter();

  const tabStructure = t("reportTabStructure");
  const tabLogic = t("reportTabLogic");
  const tabAiTrace = t("reportTabAiTrace");
  const tabRefs = t("reportTabRefs");
  const emptySection = t("reportEmptySection");

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
      overallAssessmentHeader: t("reportOverallAssessmentTitle" as never),
      overallResearchValue: t("reportOverallResearchValue" as never),
      overallMethodology: t("reportOverallMethodology" as never),
      overallArgumentation: t("reportOverallArgumentation" as never),
      overallComment: t("reportOverallComment" as never),
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

  const mergedMarkdown = useMemo(() => {
    if (!review.result) return "";
    return reviewResultToMarkdown(review.result, mdLabels);
  }, [review.result, mdLabels]);

  const statusLabel = isReviewStatus(review.status) ? ta(`status_${review.status}`) : review.status;

  const completedLabel =
    review.completed_at != null && review.completed_at.length > 0
      ? format.dateTime(new Date(review.completed_at), { dateStyle: "medium", timeStyle: "short" })
      : ta("completedAtEmpty");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <p style={{ marginBottom: 20 }}>
        <Link href="/admin/reviews" style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}>
          ← {ta("backToList")}
        </Link>
      </p>

      <div
        style={{
          marginBottom: 24,
          padding: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", color: "var(--text-primary)" }}>
          {review.file_name?.trim() ? review.file_name : ta("untitled")}
        </h1>
        <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>{ta("metaId")}</dt>
            <dd style={{ margin: 0, color: "var(--text-primary)" }}>#{review.id}</dd>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>{ta("metaEmail")}</dt>
            <dd style={{ margin: 0, color: "var(--text-primary)", wordBreak: "break-all" }}>{review.user_email}</dd>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>{ta("metaStatus")}</dt>
            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{statusLabel}</dd>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>{ta("metaCompletedAt")}</dt>
            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{completedLabel}</dd>
          </div>
        </dl>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
        {ta("sectionReport")}
      </h2>
      <div style={{ marginBottom: 32 }}>
        <ReportViewer
          tabStructure={tabStructure}
          tabLogic={tabLogic}
          tabAiTrace={tabAiTrace}
          tabRefs={tabRefs}
          placeholder={t("reportPlaceholder")}
          emptySection={emptySection}
          exportLabel={t("reportDownload")}
          result={review.result}
          exportFileStem={review.file_name}
          allowRawJson
        />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
        {ta("mergedMarkdownTitle")}
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
        {ta("mergedMarkdownHint")}
      </p>
      {!review.result ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{ta("noResultYet")}</p>
      ) : (
        <pre
          style={{
            margin: 0,
            padding: 20,
            maxHeight: "min(70vh, 720px)",
            overflow: "auto",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          {mergedMarkdown}
        </pre>
      )}
    </div>
  );
}
