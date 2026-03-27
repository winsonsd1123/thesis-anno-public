import test from "node:test";
import assert from "node:assert/strict";
import { reviewResultToMarkdown, type ReviewMarkdownLabels } from "./review-result-markdown";
import type { ReviewResult } from "@/lib/types/review";

const stubLabels: ReviewMarkdownLabels = {
  documentTitle: "Report",
  generatedPrefix: "At",
  sectionFormat: "Format",
  sectionLogic: "Logic",
  sectionAiTrace: "AI",
  sectionRefs: "Refs",
  empty: "empty",
  skipped: "skip",
  errorHeading: "ERR",
  noIssues: "none",
  severityHigh: "H",
  severityMedium: "M",
  severityLow: "L",
  fieldSeverity: "sev",
  fieldLocation: "loc",
  fieldQuote: "quote",
  fieldAnalysis: "ana",
  fieldSuggestion: "sug",
  metricsHeader: "metrics",
  metricSemanticIssues: "sem",
  metricPhysicalIssues: "phy",
  metricBaseline: "base",
  metricExtractOk: "ex",
  metricTiming: "time",
  metricPass1: "p1",
  metricPass2: "p2",
  metricMerged: "mer",
  metricTotalIssues: "tot",
  metricDurationSeconds: "sec",
  yes: "y",
  no: "n",
  refReason: "re",
  refStandard: "st",
  refCandidate: "ca",
  refYear: "yr",
  refAuthors: "au",
  refRaw: "raw",
  refLabelFact: "fact",
  refLabelFormat: "fmt",
  refsEmpty: "no refs",
  translateIssueType: (c) => c,
  translateRefFact: (f) => f,
  translateRefFormat: (f) => f,
};

test("reviewResultToMarkdown includes all four section headings", () => {
  const result: ReviewResult = {
    format_result: { issues: [], observability: { semantic_issue_count: 0, physical_issue_count: 0 } },
    logic_result: { issues: [] },
    aitrace_result: { issues: [] },
    reference_result: [],
  };
  const md = reviewResultToMarkdown(result, stubLabels);
  assert.match(md, /## Format/);
  assert.match(md, /## Logic/);
  assert.match(md, /## AI/);
  assert.match(md, /## Refs/);
});

test("reviewResultToMarkdown writes error payload", () => {
  const md = reviewResultToMarkdown({ format_result: { error: "boom" } }, stubLabels);
  assert.match(md, /boom/);
});

test("reviewResultToMarkdown appends physical anchors to format location", () => {
  const result: ReviewResult = {
    format_result: {
      issues: [
        {
          issue_type: "physical_layout_violation",
          severity: "Medium",
          chapter: "第一章（1 级标题）",
          quote_text: "示例",
          analysis: "a",
          suggestion: "s",
          paragraph_index: 2,
          document_partition: "main_body",
          paragraph_context: "body",
          paragraph_style_id: "Normal",
        },
      ],
      observability: {},
    },
    logic_result: { issues: [] },
    aitrace_result: { issues: [] },
    reference_result: [],
  };
  const md = reviewResultToMarkdown(result, stubLabels);
  assert.match(md, /loc.*第一章/);
  assert.match(md, /main_body[\s\S]*body/);
});
