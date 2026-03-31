import type { ReviewResult } from "@/lib/types/review";
import { stripEmptyHtmlAnchors } from "@/lib/review/strip-empty-html-anchors";

export type ReviewMarkdownLabels = {
  documentTitle: string;
  generatedPrefix: string;
  sectionFormat: string;
  sectionLogic: string;
  sectionAiTrace: string;
  sectionRefs: string;
  empty: string;
  skipped: string;
  errorHeading: string;
  noIssues: string;
  severityHigh: string;
  severityMedium: string;
  severityLow: string;
  fieldSeverity: string;
  fieldLocation: string;
  fieldQuote: string;
  fieldAnalysis: string;
  fieldSuggestion: string;
  metricsHeader: string;
  metricSemanticIssues: string;
  metricPhysicalIssues: string;
  metricBaseline: string;
  metricExtractOk: string;
  metricTiming: string;
  metricPass1: string;
  metricPass2: string;
  metricMerged: string;
  /** 逻辑检查 Markdown 摘要：条数 / 耗时（秒） */
  metricTotalIssues: string;
  metricDurationSeconds: string;
  yes: string;
  no: string;
  refReason: string;
  refStandard: string;
  refCandidate: string;
  refYear: string;
  refAuthors: string;
  refRaw: string;
  refLabelFact: string;
  refLabelFormat: string;
  refsEmpty: string;
  overallAssessmentHeader: string;
  overallResearchValue: string;
  overallMethodology: string;
  overallArgumentation: string;
  overallComment: string;
  translateIssueType: (code: string) => string;
  translateRefFact: (fact: string) => string;
  translateRefFormat: (fmt: string) => string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isErrorPayload(v: unknown): v is { error: string } {
  return isRecord(v) && typeof v.error === "string";
}

function isSkippedPayload(v: unknown): boolean {
  return isRecord(v) && v.skipped === true;
}

function severityText(sev: unknown, l: ReviewMarkdownLabels): string {
  if (sev === "High") return l.severityHigh;
  if (sev === "Medium") return l.severityMedium;
  if (sev === "Low") return l.severityLow;
  return String(sev ?? "—");
}

function fenceBlock(text: string): string {
  const body = text.replace(/\r\n/g, "\n").trim() || "—";
  const delim = body.includes("```") ? "````" : "```";
  return `${delim}\n${body}\n${delim}`;
}

function formatIssuesMarkdown(
  payload: unknown,
  l: ReviewMarkdownLabels,
  tab: "format" | "logic" | "aitrace"
): string {
  if (payload === undefined || payload === null) return l.empty;
  if (isSkippedPayload(payload)) return l.skipped;
  if (isErrorPayload(payload)) return `**${l.errorHeading}** ${payload.error}`;

  if (!isRecord(payload)) return fenceBlock(JSON.stringify(payload, null, 2));

  const issuesRaw = payload.issues;
  const issueCount = Array.isArray(issuesRaw) ? issuesRaw.length : 0;
  const lines: string[] = [];
  const obs = isRecord(payload.observability) ? payload.observability : null;

  if (tab === "format") {
    lines.push(`### ${l.metricsHeader}`);
    const totalMs = obs
      ? (Number(obs.semantic_llm_ms) || 0) +
        (Number(obs.spec_extract_ms) || 0) +
        (Number(obs.rules_ms) || 0)
      : 0;
    lines.push(
      `- ${l.metricTotalIssues}: ${issueCount}`,
      `- ${l.metricDurationSeconds}: ${obs && totalMs > 0 ? String(Math.round(totalMs / 1000)) : "—"}`
    );
    lines.push("");
  }

  if (tab === "logic") {
    lines.push(`### ${l.metricsHeader}`);
    const totalMs = obs
      ? (Number(obs.pass1_duration_ms) || 0) + (Number(obs.pass2_duration_ms) || 0)
      : 0;
    const hasTiming = obs && (obs.pass1_duration_ms != null || obs.pass2_duration_ms != null);
    lines.push(
      `- ${l.metricTotalIssues}: ${
        obs && obs.merged_issue_count != null ? String(obs.merged_issue_count) : issueCount
      }`,
      `- ${l.metricDurationSeconds}: ${hasTiming ? String(Math.round(totalMs / 1000)) : "—"}`
    );
    lines.push("");
  }

  if (tab === "aitrace") {
    lines.push(`### ${l.metricsHeader}`);
    const dm = obs?.duration_ms;
    lines.push(
      `- ${l.metricTotalIssues}: ${issueCount}`,
      `- ${l.metricDurationSeconds}: ${dm != null ? String(Math.round((Number(dm) || 0) / 1000)) : "—"}`
    );
    lines.push("");
  }
  if (tab === "logic" && isRecord(payload.overall_assessment)) {
    const oa = payload.overall_assessment as Record<string, unknown>;
    lines.push(`### ${l.overallAssessmentHeader}`);
    lines.push("");
    const dims: [string, string][] = [
      ["research_value", l.overallResearchValue],
      ["methodology_fitness", l.overallMethodology],
      ["argumentation_completeness", l.overallArgumentation],
      ["overall_comment", l.overallComment],
    ];
    for (const [key, label] of dims) {
      const text = typeof oa[key] === "string" ? (oa[key] as string).trim() : "";
      if (text) {
        lines.push(`**${label}** ${text}`, "");
      }
    }
  }

  if (!Array.isArray(issuesRaw)) {
    lines.push(fenceBlock(JSON.stringify(payload, null, 2)));
    return lines.join("\n");
  }

  if (issuesRaw.length === 0) {
    lines.push(`*${l.noIssues}*`);
    return lines.join("\n");
  }

  let n = 0;
  for (const item of issuesRaw) {
    if (!isRecord(item)) continue;
    n += 1;
    const sev = severityText(item.severity, l);
    const issueTypeRaw = typeof item.issue_type === "string" ? item.issue_type : "—";
    const typeLabel = l.translateIssueType(issueTypeRaw);
    const quote = stripEmptyHtmlAnchors(typeof item.quote_text === "string" ? item.quote_text : "");
    const analysis = typeof item.analysis === "string" ? item.analysis : "";
    const suggestion = typeof item.suggestion === "string" ? item.suggestion : "";

    let location = "—";
    if (tab === "format") {
      location = stripEmptyHtmlAnchors(typeof item.chapter === "string" ? item.chapter : "—");
      if (issueTypeRaw === "physical_layout_violation") {
        const extras: string[] = [];
        const dp = typeof item.document_partition === "string" ? item.document_partition.trim() : "";
        if (dp) extras.push(dp);
        const pc = typeof item.paragraph_context === "string" ? item.paragraph_context.trim() : "";
        if (pc) extras.push(pc);
        
        // 隐藏不必要的内部样式 ID
        // const sid =
        //   typeof item.paragraph_style_id === "string" ? item.paragraph_style_id.trim() : "";
        // if (sid) extras.push(`style:${sid}`);
        
        if (extras.length) location = `${location} · ${extras.join(" · ")}`;
      }
    } else if (tab === "logic") {
      location = stripEmptyHtmlAnchors(typeof item.section_heading === "string" ? item.section_heading : "—");
    } else {
      const ch = stripEmptyHtmlAnchors(typeof item.chapter === "string" ? item.chapter : "");
      const loc = stripEmptyHtmlAnchors(typeof item.location_anchor === "string" ? item.location_anchor : "");
      location = [ch, loc].filter(Boolean).join(" · ") || "—";
    }

    lines.push(`#### ${n}. ${typeLabel}`);
    lines.push(
      "",
      `- **${l.fieldSeverity}** ${sev}`,
      `- **${l.fieldLocation}** ${location.replace(/\n/g, " ")}`,
      "",
      `**${l.fieldQuote}**`,
      "",
      fenceBlock(quote),
      "",
      `**${l.fieldAnalysis}** ${analysis}`,
      "",
      `**${l.fieldSuggestion}** ${suggestion}`,
      ""
    );
  }

  return lines.join("\n").trimEnd();
}

function formatRefsMarkdown(payload: unknown, l: ReviewMarkdownLabels): string {
  if (payload === undefined || payload === null) return l.empty;
  if (isSkippedPayload(payload)) return l.skipped;
  if (isErrorPayload(payload)) return `**${l.errorHeading}** ${payload.error}`;

  let rows: unknown[] = [];
  let refObs: Record<string, unknown> | null = null;
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (isRecord(payload) && Array.isArray(payload.rows)) {
    rows = payload.rows;
    refObs = isRecord(payload.observability) ? payload.observability : null;
  } else if (isRecord(payload)) {
    return fenceBlock(JSON.stringify(payload, null, 2));
  } else {
    return fenceBlock(JSON.stringify(payload, null, 2));
  }

  const lines: string[] = [];
  lines.push(`### ${l.metricsHeader}`);
  const totalMs = refObs ? Number(refObs.duration_ms) || 0 : 0;
  lines.push(
    `- ${l.metricTotalIssues}: ${rows.length}`,
    `- ${l.metricDurationSeconds}: ${refObs && totalMs > 0 ? String(Math.round(totalMs / 1000)) : "—"}`
  );
  lines.push("");

  if (rows.length === 0) return lines.join("\n").trimEnd() + `\n\n*${l.refsEmpty}*`;

  let n = 0;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    n += 1;
    const id = typeof row.id === "number" ? row.id : n;
    const title = typeof row.title === "string" ? row.title : "";
    const rawText = typeof row.rawText === "string" ? row.rawText : "";
    const fact = typeof row.fact_status === "string" ? row.fact_status : "";
    const fmt = typeof row.format_status === "string" ? row.format_status : "";
    const reason = typeof row.reason === "string" ? row.reason : "";
    const std = typeof row.standard_format === "string" ? row.standard_format.trim() : "";
    const authors = Array.isArray(row.authors) ? row.authors.filter((x) => typeof x === "string") : [];
    const cand = isRecord(row.database_candidate) ? row.database_candidate : null;

    lines.push(`#### #${id} ${title || "—"}`);
    lines.push(
      "",
      `- **${l.refLabelFact}** ${l.translateRefFact(fact)}`,
      `- **${l.refLabelFormat}** ${l.translateRefFormat(fmt)}`,
      ""
    );
    if (authors.length > 0) {
      lines.push(`**${l.refAuthors}** ${authors.join(", ")}`, "");
    }
    lines.push(`**${l.refRaw}**`, "", fenceBlock(rawText), "");
    if (reason) lines.push(`**${l.refReason}** ${reason}`, "");
    if (std) lines.push(`**${l.refStandard}** ${std}`, "");

    if (cand) {
      const ct = typeof cand.title === "string" ? cand.title : "";
      const yr = typeof cand.year === "number" ? String(cand.year) : "";
      const doi = typeof cand.doi === "string" ? cand.doi : "";
      const src = typeof cand.source === "string" ? cand.source : "";
      lines.push(`**${l.refCandidate}**`);
      if (ct) lines.push(`- ${ct}`);
      if (yr) lines.push(`- ${l.refYear}: ${yr}`);
      if (doi) lines.push(`- DOI: ${doi}`);
      if (src) lines.push(`- ${src}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}

/**
 * 将一次审阅四维结果汇总为单个 Markdown 文档（供用户下载）。
 */
export function reviewResultToMarkdown(result: ReviewResult | null, l: ReviewMarkdownLabels): string {
  const now = new Date();
  const iso = now.toISOString();

  const parts: string[] = [
    `# ${l.documentTitle}`,
    "",
    `${l.generatedPrefix} ${iso}`,
    "",
    "---",
    "",
    `## ${l.sectionFormat}`,
    "",
    formatIssuesMarkdown(result?.format_result, l, "format"),
    "",
    "---",
    "",
    `## ${l.sectionLogic}`,
    "",
    formatIssuesMarkdown(result?.logic_result, l, "logic"),
    "",
    "---",
    "",
    `## ${l.sectionAiTrace}`,
    "",
    formatIssuesMarkdown(result?.aitrace_result, l, "aitrace"),
    "",
    "---",
    "",
    `## ${l.sectionRefs}`,
    "",
    formatRefsMarkdown(result?.reference_result, l),
    "",
  ];

  return parts.join("\n").trimEnd() + "\n";
}
