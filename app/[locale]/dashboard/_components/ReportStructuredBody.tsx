"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  REPORT_ISSUE_TYPE_KEYS,
  REPORT_PARTITION_KEYS,
  REPORT_PARAGRAPH_CONTEXT_KEYS,
} from "@/lib/review/report-issue-types";
import { stripEmptyHtmlAnchors } from "@/lib/review/strip-empty-html-anchors";
import { buildReportRunSummaryParts } from "@/lib/review/report-run-summary";

type TabId = "structure" | "logic" | "aitrace" | "refs";

const REPORT_RUN_NOTE_STYLE: CSSProperties = {
  margin: "0 0 20px 0",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  fontSize: 13,
  lineHeight: 1.6,
  color: "var(--text-secondary)",
};

type Severity = "High" | "Medium" | "Low";

function issueTypeLabel(t: ReturnType<typeof useTranslations>, raw: string): string {
  const safe = raw.trim() || "unknown";
  if (REPORT_ISSUE_TYPE_KEYS.has(safe)) {
    return t(`reportIssueType_${safe}` as never);
  }
  return t("reportIssueType_other", { type: safe });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isErrorPayload(v: unknown): v is { error: string } {
  return isRecord(v) && typeof v.error === "string";
}

function isSkippedPayload(v: unknown): boolean {
  return isRecord(v) && v.skipped === true;
}

function severityLabel(t: ReturnType<typeof useTranslations>, sev: Severity): string {
  if (sev === "High") return t("reportSeverityHigh");
  if (sev === "Medium") return t("reportSeverityMedium");
  return t("reportSeverityLow");
}

/** 高 / 中 / 低：色条、底纹、徽章、阴影分层区分，避免仅靠文字 */
function severityVisual(sev: Severity): {
  accent: string;
  cardBg: string;
  cardShadow: string;
  stripe: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  Icon: typeof AlertTriangle;
} {
  if (sev === "High") {
    return {
      accent: "var(--danger)",
      cardBg:
        "linear-gradient(142deg, rgba(239,68,68,0.09) 0%, var(--bg-subtle) 42%, rgba(255,255,255,0.92) 100%)",
      cardShadow: "0 2px 14px rgba(239, 68, 68, 0.1), var(--shadow-sm)",
      stripe: "linear-gradient(180deg, var(--danger) 0%, #F87171 100%)",
      badgeBg: "rgba(239, 68, 68, 0.14)",
      badgeColor: "var(--danger)",
      badgeBorder: "1px solid rgba(239, 68, 68, 0.38)",
      Icon: AlertTriangle,
    };
  }
  if (sev === "Medium") {
    return {
      accent: "var(--warning)",
      cardBg:
        "linear-gradient(142deg, rgba(245,158,11,0.1) 0%, var(--bg-subtle) 42%, rgba(255,255,255,0.94) 100%)",
      cardShadow: "0 2px 12px rgba(245, 158, 11, 0.09), var(--shadow-sm)",
      stripe: "linear-gradient(180deg, #D97706 0%, var(--warning) 100%)",
      badgeBg: "rgba(245, 158, 11, 0.18)",
      badgeColor: "#B45309",
      badgeBorder: "1px solid rgba(217, 119, 6, 0.42)",
      Icon: AlertCircle,
    };
  }
  return {
    accent: "var(--teal)",
    cardBg:
      "linear-gradient(142deg, rgba(0,180,166,0.07) 0%, var(--bg-subtle) 42%, rgba(255,255,255,0.96) 100%)",
    cardShadow: "0 2px 10px rgba(0, 180, 166, 0.06), var(--shadow-sm)",
    stripe: "linear-gradient(180deg, var(--teal) 0%, #2DD4BF 100%)",
    badgeBg: "var(--teal-bg)",
    badgeColor: "var(--teal)",
    badgeBorder: "1px solid rgba(0, 180, 166, 0.32)",
    Icon: Info,
  };
}

function IssueCard(props: {
  index: number;
  meta: string;
  issueTypeLabel: string;
  severity: Severity;
  quote: string;
  analysis: string;
  suggestion: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const { index, meta, issueTypeLabel: typeLabel, severity, quote, analysis, suggestion, t } = props;
  const sv = severityVisual(severity);
  const SevIcon = sv.Icon;
  return (
    <article
      className="animate-fade-up"
      style={{
        animationDelay: `${Math.min(index, 12) * 0.04}s`,
        opacity: 0,
        marginBottom: 14,
        borderRadius: 14,
        border: `1px solid color-mix(in srgb, ${sv.accent} 18%, var(--border))`,
        background: sv.cardBg,
        boxShadow: sv.cardShadow,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", minHeight: 72 }}>
        <div
          aria-hidden
          style={{
            width: 5,
            flexShrink: 0,
            background: sv.stripe,
            boxShadow: `inset -1px 0 0 color-mix(in srgb, ${sv.accent} 25%, transparent)`,
          }}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px 12px",
          }}
        >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.02em",
                padding: "5px 11px",
                borderRadius: 999,
                background: sv.badgeBg,
                color: sv.badgeColor,
                border: sv.badgeBorder,
                lineHeight: 1.2,
                boxShadow: `0 1px 0 color-mix(in srgb, ${sv.accent} 12%, transparent)`,
              }}
            >
              <SevIcon size={15} strokeWidth={2.25} aria-hidden style={{ flexShrink: 0 }} />
              {severityLabel(t, severity)}
            </span>
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 8,
                background: "color-mix(in srgb, var(--brand-bg) 85%, transparent)",
                color: "var(--brand-dark)",
                fontWeight: 600,
                lineHeight: 1.35,
                maxWidth: "100%",
                border: "1px solid color-mix(in srgb, var(--brand) 14%, var(--border))",
              }}
            >
              {typeLabel}
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.45,
              marginBottom: 10,
              whiteSpace: "pre-line",
            }}
          >
            {meta}
          </p>
          <blockquote
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(15, 23, 42, 0.04)",
              border: "1px dashed var(--border-strong)",
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--text-secondary)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {quote || "—"}
          </blockquote>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("reportAnalysis")}</span>
            {analysis}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--teal)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("reportSuggestion")}</span>
            {suggestion}
          </div>
        </div>
        </div>
      </div>
    </article>
  );
}

const OVERALL_DIMENSIONS: { key: string; labelKey: string }[] = [
  { key: "research_value", labelKey: "reportOverallResearchValue" },
  { key: "methodology_fitness", labelKey: "reportOverallMethodology" },
  { key: "argumentation_completeness", labelKey: "reportOverallArgumentation" },
  { key: "overall_comment", labelKey: "reportOverallComment" },
];

function OverallAssessmentCard(props: {
  assessment: Record<string, unknown>;
  t: ReturnType<typeof useTranslations>;
}) {
  const { assessment, t } = props;
  return (
    <article
      className="animate-fade-up"
      style={{
        marginBottom: 20,
        borderRadius: 14,
        border: "1px solid color-mix(in srgb, var(--brand) 25%, var(--border))",
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--brand) 6%, var(--surface)) 0%, var(--surface) 100%)",
        boxShadow: "0 2px 12px color-mix(in srgb, var(--brand) 8%, transparent), var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid color-mix(in srgb, var(--brand) 12%, var(--border))",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--brand)",
            letterSpacing: "0.3px",
          }}
        >
          {t("reportOverallAssessmentTitle" as never)}
        </h3>
      </div>
      <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {OVERALL_DIMENSIONS.map(({ key, labelKey }) => {
          const text = typeof assessment[key] === "string" ? (assessment[key] as string) : "";
          if (!text) return null;
          return (
            <div key={key}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {t(labelKey as never)}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--text-secondary)",
                }}
              >
                {text}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ReferenceRow(props: {
  row: Record<string, unknown>;
  index: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const { row, index, t } = props;
  const id = typeof row.id === "number" ? row.id : index + 1;
  const title = typeof row.title === "string" ? row.title : "";
  const rawText = typeof row.rawText === "string" ? row.rawText : "";
  const fact = row.fact_status;
  const fmt = row.format_status;
  const reason = typeof row.reason === "string" ? row.reason : "";
  const std = typeof row.standard_format === "string" ? row.standard_format : "";
  const cand = isRecord(row.database_candidate) ? row.database_candidate : null;

  const [expanded, setExpanded] = useState(false);
  const previewLen = 220;
  const long = rawText.length > previewLen;

  function badgeStyle(kind: "ok" | "warn" | "bad"): CSSProperties {
    if (kind === "ok")
      return { background: "rgba(16, 185, 129, 0.12)", color: "var(--success)", borderColor: "rgba(16,185,129,0.35)" };
    if (kind === "warn")
      return { background: "rgba(245, 158, 11, 0.12)", color: "var(--warning)", borderColor: "rgba(245,158,11,0.35)" };
    return { background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderColor: "rgba(239,68,68,0.35)" };
  }

  function factKind(): "ok" | "warn" | "bad" {
    if (fact === "real") return "ok";
    if (fact === "suspected") return "warn";
    return "bad";
  }

  function formatKind(): "ok" | "warn" | "bad" {
    return fmt === "standard" ? "ok" : "bad";
  }

  const factLabel =
    fact === "real"
      ? t("reportRefFact_real")
      : fact === "suspected"
        ? t("reportRefFact_suspected")
        : fact === "fake_or_not_found"
          ? t("reportRefFact_fake")
          : String(fact ?? "—");

  const fmtLabel = fmt === "standard" ? t("reportRefFmt_standard") : t("reportRefFmt_unstandard");

  return (
    <article
      className="animate-fade-up"
      style={{
        animationDelay: `${Math.min(index, 16) * 0.03}s`,
        opacity: 0,
        marginBottom: 12,
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          #{id}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: 999,
            border: "1px solid",
            ...badgeStyle(factKind()),
          }}
        >
          {factLabel}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: 999,
            border: "1px solid",
            ...badgeStyle(formatKind()),
          }}
        >
          {fmtLabel}
        </span>
      </div>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 8 }}>
        {title || t("reportRefUntitled")}
      </h4>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {expanded || !long ? rawText : `${rawText.slice(0, previewLen)}…`}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brand)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? t("reportRefCollapse") : t("reportRefExpand")}
        </button>
      ) : null}
      {reason ? (
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("reportRefReason")}</span>
          {reason}
        </p>
      ) : null}
      {std ? (
        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "var(--teal)" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("reportRefStandardHint")}</span>
          {std}
        </p>
      ) : null}
      {cand && (cand.title != null || cand.year != null || cand.doi != null) ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--bg-subtle)",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{t("reportRefCandidate")}</div>
          {typeof cand.title === "string" ? <div>{cand.title}</div> : null}
          {typeof cand.year === "number" ? (
            <div>
              {t("reportRefYear")}: {cand.year}
            </div>
          ) : null}
          {typeof cand.doi === "string" && cand.doi ? <div>DOI: {cand.doi}</div> : null}
          {typeof cand.source === "string" ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>{cand.source}</div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function parseSeverity(v: unknown): Severity {
  if (v === "High" || v === "Medium" || v === "Low") return v;
  return "Low";
}

export function ReportStructuredBody({ tab, value, emptyLabel }: { tab: TabId; value: unknown; emptyLabel: string }) {
  const t = useTranslations("dashboard.review");

  const fallbackJson = useMemo(() => JSON.stringify(value, null, 2), [value]);

  if (value === undefined || value === null) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>
        {emptyLabel}
      </p>
    );
  }

  if (isSkippedPayload(value)) {
    return (
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          background: "var(--bg-muted)",
          border: "1px dashed var(--border-strong)",
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.65,
        }}
      >
        {t("reportSkipped")}
      </div>
    );
  }

  if (isErrorPayload(value)) {
    return (
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          background: "rgba(239, 68, 68, 0.06)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          fontSize: 14,
          color: "var(--danger)",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <strong style={{ display: "block", marginBottom: 8, color: "var(--danger)" }}>{t("reportErrorTitle")}</strong>
        {value.error}
      </div>
    );
  }

  if (tab === "refs") {
    let refRows: unknown[] | null = null;
    let refObs: Record<string, unknown> | null = null;
    if (Array.isArray(value)) {
      refRows = value;
    } else if (isRecord(value) && Array.isArray(value.rows)) {
      refRows = value.rows;
      refObs = isRecord(value.observability) ? value.observability : null;
    } else if (isRecord(value)) {
      return (
        <div>
          <p style={{ fontSize: 13, color: "var(--warning)", marginBottom: 12 }}>{t("reportLegacyShape")}</p>
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
            {fallbackJson}
          </pre>
        </div>
      );
    } else {
      return (
        <div>
          <p style={{ fontSize: 13, color: "var(--warning)", marginBottom: 12 }}>{t("reportLegacyShape")}</p>
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
            {fallbackJson}
          </pre>
        </div>
      );
    }

    const summaryPayload: Record<string, unknown> = {};
    if (refObs) summaryPayload.observability = refObs;
    const refParts = buildReportRunSummaryParts("refs", summaryPayload, refRows.length);
    const refSummary = t("reportSectionRunSummary", { count: refParts.count, seconds: refParts.seconds });

    if (refRows.length === 0) {
      return (
        <div>
          <p style={REPORT_RUN_NOTE_STYLE}>{refSummary}</p>
          <div
            style={{
              textAlign: "center",
              padding: "28px 16px",
              borderRadius: 16,
              border: "1px dashed var(--border-strong)",
              background: "linear-gradient(180deg, var(--bg-subtle) 0%, var(--surface) 100%)",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              {t("reportRefsEmptyTitle")}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
              {t("reportRefsEmptyHint")}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div>
        <p style={REPORT_RUN_NOTE_STYLE}>{refSummary}</p>
        {refRows.map((row, i) =>
          isRecord(row) ? <ReferenceRow key={i} row={row} index={i} t={t} /> : null
        )}
      </div>
    );
  }

  if (!isRecord(value)) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "var(--warning)", marginBottom: 12 }}>{t("reportLegacyShape")}</p>
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
          {fallbackJson}
        </pre>
      </div>
    );
  }

  const issuesRaw = value.issues;
  if (!Array.isArray(issuesRaw)) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "var(--warning)", marginBottom: 12 }}>{t("reportLegacyShape")}</p>
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
          {fallbackJson}
        </pre>
      </div>
    );
  }

  const sectionRunSummary =
    (tab === "structure" || tab === "logic" || tab === "aitrace") && isRecord(value) && Array.isArray(issuesRaw)
      ? (() => {
          const tabKey = tab === "structure" ? "structure" : tab === "logic" ? "logic" : "aitrace";
          const parts = buildReportRunSummaryParts(tabKey, value, issuesRaw.length);
          return t("reportSectionRunSummary", { count: parts.count, seconds: parts.seconds });
        })()
      : null;

  const cards = issuesRaw
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const severity = parseSeverity(item.severity);
      const issueType = typeof item.issue_type === "string" ? item.issue_type : "—";
      const quote = stripEmptyHtmlAnchors(typeof item.quote_text === "string" ? item.quote_text : "");
      const analysis = typeof item.analysis === "string" ? item.analysis : "";
      const suggestion = typeof item.suggestion === "string" ? item.suggestion : "";

      let meta = "";
      if (tab === "structure") {
        const ch = stripEmptyHtmlAnchors(typeof item.chapter === "string" ? item.chapter : "—");
        if (issueType === "physical_layout_violation") {
          const lines: string[] = [ch];
          const dp = typeof item.document_partition === "string" ? item.document_partition.trim() : "";
          if (dp) {
            lines.push(
              REPORT_PARTITION_KEYS.has(dp)
                ? t(`reportPartition_${dp}` as never)
                : dp
            );
          }
          const pc = typeof item.paragraph_context === "string" ? item.paragraph_context.trim() : "";
          if (pc) {
            lines.push(
              REPORT_PARAGRAPH_CONTEXT_KEYS.has(pc)
                ? t(`reportParagraphContext_${pc}` as never)
                : pc
            );
          }
          const sid =
            typeof item.paragraph_style_id === "string" ? item.paragraph_style_id.trim() : "";
          // 隐藏内部生成的难以理解的样式 ID，避免干扰用户
          // if (sid) lines.push(t("reportPhysicalStyleId", { id: sid }));
          meta = lines.join("\n");
        } else {
          meta = ch;
        }
      } else if (tab === "logic") {
        meta = stripEmptyHtmlAnchors(typeof item.section_heading === "string" ? item.section_heading : "—");
      } else {
        const ch = stripEmptyHtmlAnchors(typeof item.chapter === "string" ? item.chapter : "");
        const loc = stripEmptyHtmlAnchors(typeof item.location_anchor === "string" ? item.location_anchor : "");
        meta = [ch, loc].filter(Boolean).join(" · ") || "—";
      }

      return (
        <IssueCard
          key={index}
          index={index}
          meta={meta}
          issueTypeLabel={issueTypeLabel(t, issueType)}
          severity={severity}
          quote={quote}
          analysis={analysis}
          suggestion={suggestion}
          t={t}
        />
      );
    })
    .filter(Boolean);

  const overallAssessment =
    tab === "logic" && isRecord(value) && isRecord(value.overall_assessment)
      ? (value.overall_assessment as Record<string, unknown>)
      : null;

  return (
    <div>
      {sectionRunSummary ? <p style={REPORT_RUN_NOTE_STYLE}>{sectionRunSummary}</p> : null}
      {tab === "structure" ? <p style={REPORT_RUN_NOTE_STYLE}>{t("reportFormatExperimentalDisclaimer")}</p> : null}

      {overallAssessment ? (
        <OverallAssessmentCard assessment={overallAssessment} t={t} />
      ) : null}

      {issuesRaw.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 18px",
            borderRadius: 16,
            border: "1px dashed var(--teal)",
            background: "var(--teal-bg)",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>{t("reportNoIssuesTitle")}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
            {t("reportNoIssuesHint")}
          </p>
        </div>
      ) : (
        <div>{cards}</div>
      )}
    </div>
  );
}
