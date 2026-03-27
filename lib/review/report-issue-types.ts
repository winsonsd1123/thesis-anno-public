/** 与 format / logic / aitrace 服务中 z.enum 及 physical_layout_violation 对齐（UI 与导出共用） */
export const REPORT_ISSUE_TYPE_KEYS = new Set<string>([
  "terminology_inconsistency",
  "heading_hierarchy_error",
  "figure_table_mismatch",
  "structural_missing",
  "typo_and_grammar",
  "ai_use_disclosure",
  "physical_layout_violation",
  "structural_flaw",
  "logical_leap",
  "shallow_analysis",
  "contradiction",
  "unsupported_claim",
  "cliche_vocabulary",
  "robotic_structure",
  "over_symmetrical",
]);

/** 物理轨 `document_partition` 与 next-intl `reportPartition_*` 键对齐 */
export const REPORT_PARTITION_KEYS = new Set<string>([
  "front_cover",
  "abstract",
  "toc",
  "main_body",
  "references",
  "end_matter",
]);

/** 物理轨 `paragraph_context` 与 `reportParagraphContext_*` 键对齐 */
export const REPORT_PARAGRAPH_CONTEXT_KEYS = new Set<string>([
  "body",
  "table_cell",
  "caption",
  "references",
  "footnotes",
]);
