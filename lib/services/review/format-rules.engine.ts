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
};

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
  for (const rule of headingRules) {
    if (rule.match.kind !== "heading_level") continue;
    if (rule.sizePt === undefined) continue;
    if (Math.abs(node.size_pt - rule.sizePt) > tol) continue;
    if (rule.fontAllowlist && rule.fontAllowlist.length > 0) {
      if (!fontMatches(node.font, rule.fontAllowlist)) continue;
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

function nearestHeadingPath(
  nodes: DocxStyleAstNode[],
  index: number,
  baseline: FormatEngineBaseline,
  headingRules: CompiledParagraphRule[],
  tol: number,
): string {
  for (let i = index; i >= 0; i--) {
    const n = nodes[i];
    if (!n || n.text.trim().length === 0) continue;
    const lvl =
      inferHeadingLevelByStyle(n.paragraphStyleId, baseline) ??
      inferHeadingLevelByFormat(n, headingRules, tol);
    if (lvl !== null) {
      return `L${lvl} ${n.text.trim().slice(0, 40)}`;
    }
  }
  return "正文";
}

function checkParagraphLevel(
  node: { font?: string; size_pt?: number; bold?: boolean },
  rule: CompiledParagraphRule,
  chapter: string,
  quote: string,
  tol: number,
  issues: PhysicalLayoutIssue[],
): void {
  if (rule.fontAllowlist && rule.fontAllowlist.length > 0) {
    if (!fontMatches(node.font, rule.fontAllowlist)) {
      issues.push({
        chapter,
        quote_text: quote,
        issue_type: "physical_layout_violation",
        severity: "Medium",
        analysis: `规则 ${rule.id}：期望字体在 [${rule.fontAllowlist.join(", ")}]，实际为 ${node.font ?? "(无)"}`,
        suggestion: `将段落字体调整为规范要求的字体（如 ${rule.fontAllowlist[0]}）。`,
      });
    }
  }
  if (rule.sizePt !== undefined && node.size_pt !== undefined) {
    if (Math.abs(node.size_pt - rule.sizePt) > tol) {
      issues.push({
        chapter,
        quote_text: quote,
        issue_type: "physical_layout_violation",
        severity: "Medium",
        analysis: `规则 ${rule.id}：期望约 ${rule.sizePt}pt，实际 ${node.size_pt}pt`,
        suggestion: `将字号调整为 ${rule.sizePt} 磅左右。`,
      });
    }
  }
  if (rule.bold === true && node.bold !== true) {
    issues.push({
      chapter,
      quote_text: quote,
      issue_type: "physical_layout_violation",
      severity: "Low",
      analysis: `规则 ${rule.id}：要求加粗，当前未加粗`,
      suggestion: "对该标题应用加粗。",
    });
  }
  if (rule.bold === false && node.bold === true) {
    issues.push({
      chapter,
      quote_text: quote,
      issue_type: "physical_layout_violation",
      severity: "Low",
      analysis: `规则 ${rule.id}：要求不加粗，当前为加粗`,
      suggestion: "取消加粗。",
    });
  }
}

/** 短标签阈值：run 文本 <= 该长度时视为"标签 run"（如「关键词：」），不单独对其报 body 字号/字体违规 */
const LABEL_RUN_MAX_CHARS = 8;

/**
 * 逐 run 检查 body 规则。对每个非标签 run 检查字体/字号。
 * 若段内存在多种字号（排除标签 run），额外报一条段内不一致。
 */
function checkBodyRunLevel(
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
    const runQuote = run.text.trim().slice(0, 30);
    if (rule.fontAllowlist && rule.fontAllowlist.length > 0) {
      if (!fontMatches(run.font, rule.fontAllowlist)) {
        issues.push({
          chapter,
          quote_text: runQuote,
          issue_type: "physical_layout_violation",
          severity: "Medium",
          analysis: `规则 ${rule.id}（run 级）：期望字体在 [${rule.fontAllowlist.join(", ")}]，实际为 ${run.font ?? "(无)"}`,
          suggestion: `将该文本片段字体调整为规范要求的字体（如 ${rule.fontAllowlist[0]}）。`,
        });
      }
    }
    if (rule.sizePt !== undefined && run.size_pt !== undefined) {
      if (Math.abs(run.size_pt - rule.sizePt) > tol) {
        issues.push({
          chapter,
          quote_text: runQuote,
          issue_type: "physical_layout_violation",
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
    issues.push({
      chapter,
      quote_text: quote,
      issue_type: "physical_layout_violation",
      severity: "Medium",
      analysis: `段内字号不一致：检测到 ${[...sizes].map((s) => `${s}pt`).join("、")}`,
      suggestion: "正文段落内不应出现不同字号，请统一为规范要求的字号。",
    });
  }
}

export function runPhysicalRuleEngine(
  styleAst: DocxStyleAstNode[],
  program: PhysicalRuleProgram,
  baseline: FormatEngineBaseline
): PhysicalLayoutIssue[] {
  const tol = baseline.size_tolerance_pt ?? 0.5;
  const issues: PhysicalLayoutIssue[] = [];
  const headingRules = program.rules.filter((r) => r.match.kind === "heading_level");

  const captionRules = program.rules.filter((r) => r.match.kind === "caption");

  for (let i = 0; i < styleAst.length; i++) {
    const node = styleAst[i];
    const text = node.text.trim();
    if (text.length === 0) continue;

    const ctx = node.context ?? "body";
    const chapter = nearestHeadingPath(styleAst, i, baseline, headingRules, tol);
    const quote = text.slice(0, 40);

    if (ctx === "table_cell") continue;

    if (ctx === "caption") {
      for (const rule of captionRules) {
        checkParagraphLevel(node, rule, chapter, quote, tol, issues);
      }
      continue;
    }

    const lvl =
      inferHeadingLevelByStyle(node.paragraphStyleId, baseline) ??
      inferHeadingLevelByFormat(node, headingRules, tol);

    for (const rule of program.rules) {
      let applies = false;
      if (rule.match.kind === "heading_level") {
        applies = lvl === rule.match.level;
      } else if (rule.match.kind === "body") {
        applies = lvl === null;
      } else {
        continue;
      }
      if (!applies) continue;
      if (shouldSkipBodyParagraphRule(rule, node, baseline)) continue;

      if (rule.match.kind === "body" && node.runs && node.runs.length > 1) {
        checkBodyRunLevel(node.runs, rule, chapter, quote, tol, issues);
      } else {
        checkParagraphLevel(node, rule, chapter, quote, tol, issues);
      }
    }
  }

  return issues;
}
