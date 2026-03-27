import type { DocxStyleAstNode, RunSpan } from "@/lib/types/docx-hybrid";
import type { FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";
import type { CompiledParagraphRule, PhysicalRuleProgram } from "@/lib/review/compile-physical-rules";

export type PhysicalLayoutIssue = {
  chapter: string;
  quote_text: string;
  issue_type: "physical_layout_violation";
  severity: "High" | "Medium" | "Low";
  analysis: string;
  suggestion: string;
  /** 对应 buildDocxStyleAst 返回数组的下标（0-based） */
  paragraph_index?: number;
  document_partition?: string;
  paragraph_context?: string;
  paragraph_style_id?: string;
};

function pushPhysicalIssue(
  issues: PhysicalLayoutIssue[],
  node: DocxStyleAstNode,
  astIndex: number,
  rest: Pick<PhysicalLayoutIssue, "chapter" | "quote_text" | "severity" | "analysis" | "suggestion">,
): void {
  issues.push({
    issue_type: "physical_layout_violation",
    paragraph_index: astIndex,
    document_partition: node.partition ?? "main_body",
    paragraph_context: node.context ?? "body",
    ...(node.paragraphStyleId ? { paragraph_style_id: node.paragraphStyleId } : {}),
    ...rest,
  });
}

function clipPhysicalText(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "（空段）";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 物理轨摘录：题注等短段给更长上限，避免只剩「图」一个字 */
function physicalParagraphQuote(node: DocxStyleAstNode): string {
  const max = node.context === "caption" ? 220 : 100;
  return clipPhysicalText(node.text, max);
}

/** run 级问题：短片段则拼接整段摘录，便于定位 */
function physicalRunQuote(node: DocxStyleAstNode, runSnippet: string): string {
  const r = runSnippet.replace(/\s+/g, " ").trim();
  if (r.length >= 20) return clipPhysicalText(r, 120);
  const p = physicalParagraphQuote(node);
  if (!r) return p;
  return `${clipPhysicalText(r, 40)} ｜本段｜ ${p}`;
}

function inferHeadingLevelByStyle(
  paragraphStyleId: string | undefined,
  baseline: FormatEngineBaseline
): number | null {
  if (!paragraphStyleId) return null;
  const pid = paragraphStyleId.trim();
  for (const [lvlStr, pats] of Object.entries(baseline.heading_style_patterns)) {
    const level = Number.parseInt(lvlStr, 10);
    if (Number.isNaN(level)) continue;
    for (const p of pats) {
      if (pid === p || pid.toLowerCase() === p.toLowerCase()) return level;
    }
  }
  return null;
}

/**
 * 格式回退：样式 ID 没命中，但段落的字号+字体精确匹配某条 heading 规则时，视为该级标题。
 * 仅当字号 AND 字体同时符合时才触发，避免误判。
 */
function inferHeadingLevelByFormat(
  node: DocxStyleAstNode,
  headingRules: CompiledParagraphRule[],
  tol: number,
): number | null {
  if (node.size_pt === undefined) return null;
  const nodeFont = node.font_zh ?? node.font_en;
  for (const rule of headingRules) {
    if (rule.match.kind !== "heading_level") continue;
    if (rule.sizePt === undefined) continue;
    if (Math.abs(node.size_pt - rule.sizePt) > tol) continue;
    const ruleFont = rule.fontAllowlistZh ?? rule.fontAllowlistEn;
    if (ruleFont && ruleFont.length > 0) {
      if (!fontMatches(nodeFont, ruleFont)) continue;
    }
    return rule.match.level;
  }
  return null;
}

function normFont(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function fontMatches(nodeFont: string | undefined, allowed: string[]): boolean {
  if (!nodeFont) return false;
  const n = normFont(nodeFont);
  return allowed.some((a) => {
    const an = normFont(a);
    return n.includes(an) || an.includes(n);
  });
}

function paragraphStyleExcludedFromBody(
  paragraphStyleId: string | undefined,
  substrings: string[] | undefined
): boolean {
  if (!paragraphStyleId || !substrings?.length) return false;
  const pid = paragraphStyleId.trim();
  const low = pid.toLowerCase();
  for (const s of substrings) {
    const t = s.trim();
    if (!t) continue;
    if (pid.includes(t) || low.includes(t.toLowerCase())) return true;
  }
  return false;
}

/** 非标题段落但明显不是「正文段落」语义时，勿套用 body-default */
function shouldSkipBodyParagraphRule(
  rule: CompiledParagraphRule,
  node: DocxStyleAstNode,
  baseline: FormatEngineBaseline
): boolean {
  if (rule.match.kind !== "body") return false;
  if (paragraphStyleExcludedFromBody(node.paragraphStyleId, baseline.body_rule_skip_style_id_substrings)) {
    return true;
  }
  const delta = baseline.body_rule_oversize_skip_delta_pt ?? 2.5;
  if (
    rule.sizePt !== undefined &&
    node.size_pt !== undefined &&
    node.size_pt > rule.sizePt + delta
  ) {
    return true;
  }
  return false;
}

/** 物理轨 issue 的 chapter：用标题原文 + 级别说明，避免与语义轨章节名割裂的「L1/L2」前缀 */
function formatPhysicalChapterLabel(level: number, rawText: string): string {
  const text = rawText.replace(/\s+/g, " ").trim().slice(0, 56);
  return `${text}（${level} 级标题）`;
}

function nearestHeadingPath(
  nodes: DocxStyleAstNode[],
  index: number,
  baseline: FormatEngineBaseline,
  headingRules: CompiledParagraphRule[],
  inferTol: number,
): string {
  for (let i = index; i >= 0; i--) {
    const n = nodes[i];
    if (!n || n.text.trim().length === 0) continue;

    if (n.outlineLevel !== undefined && n.outlineLevel >= 0 && n.outlineLevel <= 8) {
      return formatPhysicalChapterLabel(n.outlineLevel + 1, n.text);
    }

    const lvl =
      inferHeadingLevelByStyle(n.paragraphStyleId, baseline) ??
      inferHeadingLevelByFormat(n, headingRules, inferTol);
    if (lvl !== null) {
      return formatPhysicalChapterLabel(lvl, n.text);
    }
  }
  
  const p = nodes[index]?.partition;
  if (p === "front_cover") return "封面";
  if (p === "abstract") return "摘要";
  if (p === "toc") return "目录";
  if (p === "references") return "参考文献";
  return "正文";
}

function checkFontField(
  node: DocxStyleAstNode,
  astIndex: number,
  nodeFont: string | undefined,
  allowlist: string[] | undefined,
  label: string,
  ruleId: string,
  chapter: string,
  quote: string,
  issues: PhysicalLayoutIssue[],
): void {
  if (!allowlist || allowlist.length === 0) return;
  if (!fontMatches(nodeFont, allowlist)) {
    pushPhysicalIssue(issues, node, astIndex, {
      chapter,
      quote_text: quote,
      severity: "Medium",
      analysis: `规则 ${ruleId}：期望${label}在 [${allowlist.join(", ")}]，实际为 ${nodeFont ?? "(无)"}`,
      suggestion: `将${label}调整为规范要求的字体（如 ${allowlist[0]}）。`,
    });
  }
}

function checkParagraphLevel(
  node: DocxStyleAstNode,
  astIndex: number,
  rule: CompiledParagraphRule,
  chapter: string,
  quote: string,
  tol: number,
  baseline: FormatEngineBaseline,
  issues: PhysicalLayoutIssue[],
): void {
  checkFontField(node, astIndex, node.font_zh, rule.fontAllowlistZh, "中文字体", rule.id, chapter, quote, issues);
  checkFontField(node, astIndex, node.font_en, rule.fontAllowlistEn, "西文字体", rule.id, chapter, quote, issues);

  if (rule.sizePt !== undefined && node.size_pt !== undefined) {
    if (Math.abs(node.size_pt - rule.sizePt) > tol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Medium",
        analysis: `规则 ${rule.id}：期望约 ${rule.sizePt}pt，实际 ${node.size_pt}pt`,
        suggestion: `将字号调整为 ${rule.sizePt} 磅左右。`,
      });
    }
  }
  // undefined：OOXML 常未在样式链上显式写 w:b，不当作「明确未加粗」
  if (rule.bold === true && node.bold === false) {
    pushPhysicalIssue(issues, node, astIndex, {
      chapter,
      quote_text: quote,
      severity: "Low",
      analysis: `规则 ${rule.id}：要求加粗，当前未加粗`,
      suggestion: "对该标题应用加粗。",
    });
  }
  if (rule.bold === false && node.bold === true) {
    pushPhysicalIssue(issues, node, astIndex, {
      chapter,
      quote_text: quote,
      severity: "Low",
      analysis: `规则 ${rule.id}：要求不加粗，当前为加粗`,
      suggestion: "取消加粗。",
    });
  }

  checkParagraphSpacingIndent(node, rule, baseline, astIndex, chapter, quote, issues);
}

function approxIndentCharsFromPt(indentPt: number, sizePt: number): number {
  if (sizePt <= 0) return indentPt / 12;
  return indentPt / sizePt;
}

function approxIndentPtFromChars(chars: number, sizePt: number): number {
  return chars * (sizePt > 0 ? sizePt : 12);
}

function approxLinesFromPt(spacingPt: number, sizePt: number): number {
  // 单倍行距通常略大于字号，这里近似按 1行 ≈ sizePt * 1.04 计算（小四 12pt 单倍约为 15.6pt / 12 = 1.3 的那是中文字体，其实 15.6 差不多是 1.3 倍。为防止误差，简单地用 1.3 * sizePt 作为基准，15pt 对应 19.5pt，0.5 行就是 9.75pt。Word中“0.5行”常存为 w:beforeLines="50" 和 w:before="156" (7.8pt)。说明 1行 = 15.6pt = 1.04 * 15pt。因此这里用 1.04 * sizePt 估算）。
  const base = sizePt > 0 ? sizePt * 1.04 : 12 * 1.04;
  return spacingPt / base;
}

function approxPtFromLines(lines: number, sizePt: number): number {
  const base = sizePt > 0 ? sizePt * 1.04 : 12 * 1.04;
  return lines * base;
}

/** 正文首行缩进报错时：若段落居中对齐，提示可能是误用对齐或实为题注 */
function bodyIndentSuggestionSuffix(node: DocxStyleAstNode): string {
  if (node.paragraph_jc !== "center") return "";
  return " 若本段实为正文，请取消居中后再设首行缩进；若为图/表说明，请使用题注样式或规范前缀（如「图1」「注：」）。";
}

/**
 * 行距/段前后/首行缩进（AST 已解析 w:spacing / w:ind + 样式链）
 */
function checkParagraphSpacingIndent(
  node: DocxStyleAstNode,
  rule: CompiledParagraphRule,
  baseline: FormatEngineBaseline,
  astIndex: number,
  chapter: string,
  quote: string,
  issues: PhysicalLayoutIssue[],
): void {
  const spTol = baseline.spacing_tolerance_pt ?? 1;
  const mulTol = baseline.line_spacing_multiple_tolerance ?? 0.08;
  const linesTol = baseline.spacing_lines_tolerance ?? 0.15;
  const indCharsTol = baseline.indent_first_line_chars_tolerance ?? 0.2;
  const indPtTol = baseline.indent_first_line_pt_tolerance ?? 1.5;
  const refSize = node.size_pt && node.size_pt > 0 ? node.size_pt : 12;

  if (rule.lineSpacingPt !== undefined && node.line_spacing_pt !== undefined) {
    if (Math.abs(node.line_spacing_pt - rule.lineSpacingPt) > spTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Medium",
        analysis: `规则 ${rule.id}：期望固定行距约 ${rule.lineSpacingPt}pt，实际 ${node.line_spacing_pt}pt`,
        suggestion: `将段落行距调整为约 ${rule.lineSpacingPt} 磅（固定值）。`,
      });
    }
  }
  if (rule.lineSpacingMultiple !== undefined && node.line_spacing_multiple !== undefined) {
    if (Math.abs(node.line_spacing_multiple - rule.lineSpacingMultiple) > mulTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Medium",
        analysis: `规则 ${rule.id}：期望多倍行距约 ${rule.lineSpacingMultiple}，实际 ${node.line_spacing_multiple}`,
        suggestion: `将行距改为约 ${rule.lineSpacingMultiple} 倍。`,
      });
    }
  }

  // 段前 (lines)
  if (rule.spaceBeforeLines !== undefined) {
    const actualLines =
      node.space_before_lines ??
      (node.space_before_pt !== undefined ? approxLinesFromPt(node.space_before_pt, refSize) : undefined);
    if (actualLines !== undefined && Math.abs(actualLines - rule.spaceBeforeLines) > linesTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Low",
        analysis: `规则 ${rule.id}：期望段前约 ${rule.spaceBeforeLines} 行，实际约 ${actualLines.toFixed(2)} 行`,
        suggestion: `将段前间距调整为约 ${rule.spaceBeforeLines} 行。`,
      });
    }
  } else if (rule.spaceBeforePt !== undefined) {
    const actualPt =
      node.space_before_pt ??
      (node.space_before_lines !== undefined ? approxPtFromLines(node.space_before_lines, refSize) : undefined);
    if (actualPt !== undefined && Math.abs(actualPt - rule.spaceBeforePt) > spTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Low",
        analysis: `规则 ${rule.id}：期望段前约 ${rule.spaceBeforePt}pt，实际约 ${actualPt.toFixed(1)}pt`,
        suggestion: `将段前间距调整为约 ${rule.spaceBeforePt} 磅。`,
      });
    }
  }

  // 段后 (lines)
  if (rule.spaceAfterLines !== undefined) {
    const actualLines =
      node.space_after_lines ??
      (node.space_after_pt !== undefined ? approxLinesFromPt(node.space_after_pt, refSize) : undefined);
    if (actualLines !== undefined && Math.abs(actualLines - rule.spaceAfterLines) > linesTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Low",
        analysis: `规则 ${rule.id}：期望段后约 ${rule.spaceAfterLines} 行，实际约 ${actualLines.toFixed(2)} 行`,
        suggestion: `将段后间距调整为约 ${rule.spaceAfterLines} 行。`,
      });
    }
  } else if (rule.spaceAfterPt !== undefined) {
    const actualPt =
      node.space_after_pt ??
      (node.space_after_lines !== undefined ? approxPtFromLines(node.space_after_lines, refSize) : undefined);
    if (actualPt !== undefined && Math.abs(actualPt - rule.spaceAfterPt) > spTol) {
      pushPhysicalIssue(issues, node, astIndex, {
        chapter,
        quote_text: quote,
        severity: "Low",
        analysis: `规则 ${rule.id}：期望段后约 ${rule.spaceAfterPt}pt，实际约 ${actualPt.toFixed(1)}pt`,
        suggestion: `将段后间距调整为约 ${rule.spaceAfterPt} 磅。`,
      });
    }
  }

  if (rule.indentFirstLineChars !== undefined) {
    const actualChars =
      node.indent_first_line_chars ??
      (node.indent_first_line_pt !== undefined
        ? approxIndentCharsFromPt(node.indent_first_line_pt, refSize)
        : undefined);
    if (actualChars !== undefined) {
      if (Math.abs(actualChars - rule.indentFirstLineChars) > indCharsTol) {
        pushPhysicalIssue(issues, node, astIndex, {
          chapter,
          quote_text: quote,
          severity: "Medium",
          analysis: `规则 ${rule.id}：期望首行缩进约 ${rule.indentFirstLineChars} 字符，实际约 ${actualChars.toFixed(2)} 字符`,
          suggestion: `将首行缩进调整为约 ${rule.indentFirstLineChars} 个汉字宽。${bodyIndentSuggestionSuffix(node)}`,
        });
      }
    }
  }

  if (rule.indentFirstLinePt !== undefined) {
    const actualPt =
      node.indent_first_line_pt ??
      (node.indent_first_line_chars !== undefined
        ? approxIndentPtFromChars(node.indent_first_line_chars, refSize)
        : undefined);
    if (actualPt !== undefined) {
      if (Math.abs(actualPt - rule.indentFirstLinePt) > indPtTol) {
        pushPhysicalIssue(issues, node, astIndex, {
          chapter,
          quote_text: quote,
          severity: "Medium",
          analysis: `规则 ${rule.id}：期望首行缩进约 ${rule.indentFirstLinePt}pt，实际约 ${actualPt.toFixed(1)}pt`,
          suggestion: `将首行缩进调整为约 ${rule.indentFirstLinePt} 磅。${bodyIndentSuggestionSuffix(node)}`,
        });
      }
    }
  }
}

/** 短标签阈值：run 文本 <= 该长度时视为"标签 run"（如「关键词：」），不单独对其报 body 字号/字体违规 */
const LABEL_RUN_MAX_CHARS = 8;

/**
 * 逐 run 检查 body 规则。对每个非标签 run 检查字体/字号。
 * 若段内存在多种字号（排除标签 run），额外报一条段内不一致。
 */
function checkBodyRunLevel(
  node: DocxStyleAstNode,
  astIndex: number,
  runs: RunSpan[],
  rule: CompiledParagraphRule,
  chapter: string,
  quote: string,
  tol: number,
  issues: PhysicalLayoutIssue[],
): void {
  const contentRuns = runs.filter((r) => r.text.trim().length > LABEL_RUN_MAX_CHARS);
  const checkTargets = contentRuns.length > 0 ? contentRuns : runs;

  for (const run of checkTargets) {
    const runQuote = physicalRunQuote(node, run.text);
    checkFontField(node, astIndex, run.font_zh, rule.fontAllowlistZh, "中文字体", `${rule.id}（run 级）`, chapter, runQuote, issues);
    checkFontField(node, astIndex, run.font_en, rule.fontAllowlistEn, "西文字体", `${rule.id}（run 级）`, chapter, runQuote, issues);

    if (rule.sizePt !== undefined && run.size_pt !== undefined) {
      if (Math.abs(run.size_pt - rule.sizePt) > tol) {
        pushPhysicalIssue(issues, node, astIndex, {
          chapter,
          quote_text: runQuote,
          severity: "Medium",
          analysis: `规则 ${rule.id}（run 级）：期望约 ${rule.sizePt}pt，实际 ${run.size_pt}pt`,
          suggestion: `将该文本片段字号调整为 ${rule.sizePt} 磅左右。`,
        });
      }
    }
  }

  const sizes = new Set(
    checkTargets
      .map((r) => r.size_pt)
      .filter((s): s is number => s !== undefined)
  );
  if (sizes.size > 1) {
    pushPhysicalIssue(issues, node, astIndex, {
      chapter,
      quote_text: quote,
      severity: "Medium",
      analysis: `段内字号不一致：检测到 ${[...sizes].map((s) => `${s}pt`).join("、")}`,
      suggestion: "正文段落内不应出现不同字号，请统一为规范要求的字号。",
    });
  }
}

/** 参考文献列表的字体/字号由专门参考文献流程处理，不纳入物理格式引擎 */
const CONTEXT_RULE_KINDS = ["caption", "footnotes"] as const;

export function runPhysicalRuleEngine(
  styleAst: DocxStyleAstNode[],
  program: PhysicalRuleProgram,
  baseline: FormatEngineBaseline
): PhysicalLayoutIssue[] {
  const inferTol = baseline.size_tolerance_pt ?? 0.5;
  const headingCheckTol = baseline.heading_size_tolerance_pt ?? inferTol;
  const issues: PhysicalLayoutIssue[] = [];
  const headingRules = program.rules.filter((r) => r.match.kind === "heading_level");

  const contextRuleMap = new Map(
    CONTEXT_RULE_KINDS.map((kind) => [kind, program.rules.filter((r) => r.match.kind === kind)])
  );

  for (let i = 0; i < styleAst.length; i++) {
    const node = styleAst[i];
    const text = node.text.trim();
    if (text.length === 0) continue;

    if (
      node.partition === "front_cover" ||
      node.partition === "toc" ||
      node.partition === "end_matter" ||
      node.partition === "references"
    ) {
      continue;
    }

    const ctx = node.context ?? "body";
    const chapter = nearestHeadingPath(styleAst, i, baseline, headingRules, inferTol);
    const paraQuote = physicalParagraphQuote(node);

    if (ctx === "table_cell") continue;

    const ctxRules = contextRuleMap.get(ctx as typeof CONTEXT_RULE_KINDS[number]);
    if (ctxRules) {
      for (const rule of ctxRules) {
        checkParagraphLevel(node, i, rule, chapter, paraQuote, inferTol, baseline, issues);
      }
      continue;
    }

    const lvl =
      (node.outlineLevel !== undefined && node.outlineLevel >= 0 && node.outlineLevel <= 8)
        ? node.outlineLevel + 1
        : (inferHeadingLevelByStyle(node.paragraphStyleId, baseline) ??
           inferHeadingLevelByFormat(node, headingRules, inferTol));

    for (const rule of program.rules) {
      let applies = false;
      if (rule.match.kind === "heading_level") {
        applies = lvl === rule.match.level;
      } else if (rule.match.kind === "body") {
        // 正文规则仅适用于 main_body 区段
        applies = lvl === null && node.partition === "main_body";
      } else {
        continue;
      }
      if (!applies) continue;
      if (shouldSkipBodyParagraphRule(rule, node, baseline)) continue;

      const checkTol = rule.match.kind === "heading_level" ? headingCheckTol : inferTol;
      if (rule.match.kind === "body" && node.runs && node.runs.length > 1) {
        checkBodyRunLevel(node, i, node.runs, rule, chapter, paraQuote, checkTol, issues);
        checkParagraphSpacingIndent(node, rule, baseline, i, chapter, paraQuote, issues);
      } else {
        checkParagraphLevel(node, i, rule, chapter, paraQuote, checkTol, baseline, issues);
      }
    }
  }

  return issues;
}
