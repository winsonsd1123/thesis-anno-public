import type { FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";
import type { FormatPhysicalExtract } from "@/lib/schemas/format-physical-extract.schema";

export type ParagraphMatch =
  | { kind: "heading_level"; level: number }
  | { kind: "body" }
  | { kind: "caption" }
  | { kind: "footnotes" };

export type CompiledParagraphRule = {
  id: string;
  match: ParagraphMatch;
  fontAllowlistZh?: string[];
  fontAllowlistEn?: string[];
  sizePt?: number;
  bold?: boolean;
  lineSpacingPt?: number;
  lineSpacingMultiple?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  spaceBeforeLines?: number;
  spaceAfterLines?: number;
  indentFirstLineChars?: number;
  indentFirstLinePt?: number;
};

/** 全局样式规则，用于页眉/页脚/页码校验（无需 match 字段，作用域已知） */
export type CompiledStyleRule = {
  id: string;
  fontAllowlistZh?: string[];
  fontAllowlistEn?: string[];
  sizePt?: number;
  bold?: boolean;
  lineSpacingPt?: number;
  lineSpacingMultiple?: number;
  /** 底层对齐值："center" | "right" | "left" | "both" */
  alignmentVal?: string;
};

export type PhysicalRuleProgram = {
  baseline_version: string;
  rules: CompiledParagraphRule[];
  dropped_unsupported: string[];
  global_rules: {
    page_setup?: {
      marginTopCm?: number;
      marginBottomCm?: number;
      marginLeftCm?: number;
      marginRightCm?: number;
    };
    header?: CompiledStyleRule;
    footer?: CompiledStyleRule;
    page_number?: CompiledStyleRule;
  };
};

function buildFontAllowlists(fontZh?: string, fontEn?: string) {
  return {
    fontAllowlistZh: fontZh ? [fontZh] : undefined,
    fontAllowlistEn: fontEn ? [fontEn] : undefined,
  };
}

type PhysicalStyleSlice = {
  font_zh?: string;
  font_en?: string;
  size_pt?: number;
  line_spacing_pt?: number;
  line_spacing_multiple?: number;
  space_before_pt?: number;
  space_after_pt?: number;
  space_before_lines?: number;
  space_after_lines?: number;
  indent_first_line_chars?: number;
  indent_first_line_pt?: number;
};

function spacingFieldsFromExtract(s: PhysicalStyleSlice): Pick<
  CompiledParagraphRule,
  | "lineSpacingPt"
  | "lineSpacingMultiple"
  | "spaceBeforePt"
  | "spaceAfterPt"
  | "spaceBeforeLines"
  | "spaceAfterLines"
  | "indentFirstLineChars"
  | "indentFirstLinePt"
> {
  return {
    lineSpacingPt: s.line_spacing_pt,
    lineSpacingMultiple: s.line_spacing_multiple,
    spaceBeforePt: s.space_before_pt,
    spaceAfterPt: s.space_after_pt,
    spaceBeforeLines: s.space_before_lines,
    spaceAfterLines: s.space_after_lines,
    indentFirstLineChars: s.indent_first_line_chars,
    indentFirstLinePt: s.indent_first_line_pt,
  };
}

function hasAnyPhysicalFields(ctx: PhysicalStyleSlice | undefined): boolean {
  if (!ctx) return false;
  return !!(
    ctx.font_zh ||
    ctx.font_en ||
    ctx.size_pt !== undefined ||
    ctx.line_spacing_pt !== undefined ||
    ctx.line_spacing_multiple !== undefined ||
    ctx.space_before_pt !== undefined ||
    ctx.space_after_pt !== undefined ||
    ctx.space_before_lines !== undefined ||
    ctx.space_after_lines !== undefined ||
    ctx.indent_first_line_chars !== undefined ||
    ctx.indent_first_line_pt !== undefined
  );
}

export function compilePhysicalRules(
  baseline: FormatEngineBaseline,
  extract: FormatPhysicalExtract
): PhysicalRuleProgram {
  const dropped: string[] = [...(extract.notes_unenforceable ?? [])];
  const rules: CompiledParagraphRule[] = [];
  let rid = 0;

  for (const h of extract.headings) {
    rules.push({
      id: `heading-L${h.level}-${++rid}`,
      match: { kind: "heading_level", level: h.level },
      ...buildFontAllowlists(h.font_zh, h.font_en),
      sizePt: h.size_pt,
      bold: h.bold,
      ...spacingFieldsFromExtract(h),
    });
  }

  if (extract.body && hasAnyPhysicalFields(extract.body)) {
    rules.push({
      id: "body-default",
      match: { kind: "body" },
      ...buildFontAllowlists(extract.body.font_zh, extract.body.font_en),
      sizePt: extract.body.size_pt,
      ...spacingFieldsFromExtract(extract.body),
    });
  }

  if (extract.caption && hasAnyPhysicalFields(extract.caption)) {
    rules.push({
      id: "caption-default",
      match: { kind: "caption" },
      ...buildFontAllowlists(extract.caption.font_zh, extract.caption.font_en),
      sizePt: extract.caption.size_pt,
      ...spacingFieldsFromExtract(extract.caption),
    });
  }

  if (extract.footnotes && hasAnyPhysicalFields(extract.footnotes)) {
    rules.push({
      id: "footnotes-default",
      match: { kind: "footnotes" },
      ...buildFontAllowlists(extract.footnotes.font_zh, extract.footnotes.font_en),
      sizePt: extract.footnotes.size_pt,
      ...spacingFieldsFromExtract(extract.footnotes),
    });
  }

  const buildStyleRule = (
    id: string,
    s: PhysicalStyleSlice & { alignment?: string },
  ): CompiledStyleRule => ({
    id,
    ...buildFontAllowlists(s.font_zh, s.font_en),
    sizePt: s.size_pt,
    lineSpacingPt: s.line_spacing_pt,
    lineSpacingMultiple: s.line_spacing_multiple,
    ...(s.alignment ? { alignmentVal: s.alignment } : {}),
  });

  const global_rules: PhysicalRuleProgram["global_rules"] = {};

  const ps = extract.page_setup;
  if (ps) {
    const mmToCm = (mm: number | undefined) =>
      mm !== undefined ? mm / 10 : undefined;
    global_rules.page_setup = {
      marginTopCm: mmToCm(ps.margin_top_mm),
      marginBottomCm: mmToCm(ps.margin_bottom_mm),
      marginLeftCm: mmToCm(ps.margin_left_mm),
      marginRightCm: mmToCm(ps.margin_right_mm),
    };
  }

  if (extract.header && hasAnyPhysicalFields(extract.header)) {
    global_rules.header = buildStyleRule("header-global", extract.header);
  }
  if (extract.footer && hasAnyPhysicalFields(extract.footer)) {
    global_rules.footer = buildStyleRule("footer-global", extract.footer);
  }
  if (extract.page_number && hasAnyPhysicalFields(extract.page_number)) {
    global_rules.page_number = buildStyleRule("page-number-global", extract.page_number);
  }

  return {
    baseline_version: baseline.version,
    rules,
    dropped_unsupported: dropped,
    global_rules,
  };
}
