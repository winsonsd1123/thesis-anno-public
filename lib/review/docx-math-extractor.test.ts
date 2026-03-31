import assert from "node:assert";
import { test } from "node:test";
import {
  extractMathFragments,
  attachMathToStyleAst,
  appendMathToMarkdown,
  postProcessLatex,
} from "./docx-math-extractor";
import type { DocxStyleAstNode } from "@/lib/types/docx-hybrid";

const ENVELOPE_OPEN = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
<w:body>`;
const ENVELOPE_CLOSE = `</w:body></w:document>`;

function wrap(body: string): string {
  return ENVELOPE_OPEN + body + ENVELOPE_CLOSE;
}

// ---------------------------------------------------------------------------
// extractMathFragments
// ---------------------------------------------------------------------------

test("extractMathFragments: inline oMath x=y^2", () => {
  const xml = wrap(`
    <w:p>
      <w:r><w:t>其中</w:t></w:r>
      <m:oMath>
        <m:r><m:t>x</m:t></m:r>
        <m:r><m:t>=</m:t></m:r>
        <m:sSup>
          <m:e><m:r><m:t>y</m:t></m:r></m:e>
          <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
        </m:sSup>
      </m:oMath>
      <w:r><w:t>为平方关系</w:t></w:r>
    </w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 1);
  assert.strictEqual(frags[0].display, false);
  assert.strictEqual(frags[0].paragraphText, "其中为平方关系");
  assert.strictEqual(frags[0].latex.length, 1);
  assert.ok(frags[0].latex[0].includes("y"));
  assert.ok(frags[0].latex[0].includes("2"));
  assert.strictEqual(frags[0].prevText, undefined);
});

test("extractMathFragments: display oMathPara", () => {
  const xml = wrap(`
    <w:p>
      <m:oMathPara>
        <m:oMath>
          <m:r><m:t>E</m:t></m:r>
          <m:r><m:t>=</m:t></m:r>
          <m:r><m:t>m</m:t></m:r>
          <m:sSup>
            <m:e><m:r><m:t>c</m:t></m:r></m:e>
            <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
          </m:sSup>
        </m:oMath>
      </m:oMathPara>
    </w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 1);
  assert.strictEqual(frags[0].display, true);
  assert.strictEqual(frags[0].paragraphText, "");
  assert.ok(frags[0].latex[0].includes("c"));
});

test("extractMathFragments: paragraph without math returns empty", () => {
  const xml = wrap(`
    <w:p>
      <w:r><w:t>普通段落</w:t></w:r>
    </w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 0);
});

test("extractMathFragments: multiple paragraphs mixed", () => {
  const xml = wrap(`
    <w:p><w:r><w:t>第一段无公式</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>设</w:t></w:r>
      <m:oMath><m:r><m:t>a</m:t></m:r></m:oMath>
    </w:p>
    <w:p><w:r><w:t>第三段无公式</w:t></w:r></w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 1);
  assert.strictEqual(frags[0].paragraphText, "设");
});

test("extractMathFragments: display formula records prevText", () => {
  const xml = wrap(`
    <w:p><w:r><w:t>计算公式如下：</w:t></w:r></w:p>
    <w:p>
      <m:oMathPara>
        <m:oMath>
          <m:r><m:t>E</m:t></m:r>
          <m:r><m:t>=</m:t></m:r>
          <m:r><m:t>m</m:t></m:r>
          <m:sSup>
            <m:e><m:r><m:t>c</m:t></m:r></m:e>
            <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
          </m:sSup>
        </m:oMath>
      </m:oMathPara>
    </w:p>
    <w:p><w:r><w:t>其中 m 为质量</w:t></w:r></w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 1);
  assert.strictEqual(frags[0].display, true);
  assert.strictEqual(frags[0].prevText, "计算公式如下：");
});

test("extractMathFragments: consecutive display formulas share prevText from last non-math paragraph", () => {
  const xml = wrap(`
    <w:p><w:r><w:t>以下为两个公式：</w:t></w:r></w:p>
    <w:p><m:oMathPara><m:oMath><m:r><m:t>a</m:t></m:r></m:oMath></m:oMathPara></w:p>
    <w:p><m:oMathPara><m:oMath><m:r><m:t>b</m:t></m:r></m:oMath></m:oMathPara></w:p>
  `);
  const frags = extractMathFragments(xml);
  assert.strictEqual(frags.length, 2);
  assert.strictEqual(frags[0].prevText, "以下为两个公式：");
  assert.strictEqual(frags[1].prevText, "以下为两个公式：");
});

// ---------------------------------------------------------------------------
// postProcessLatex
// ---------------------------------------------------------------------------

test("postProcessLatex: merges 3+ consecutive single-letter sequences", () => {
  assert.strictEqual(
    postProcessLatex("A t t e n t i o n"),
    "\\text{Attention}",
  );
  assert.strictEqual(
    postProcessLatex("s o f t m a x"),
    "\\text{softmax}",
  );
});

test("postProcessLatex: preserves single/double letter variables", () => {
  assert.strictEqual(postProcessLatex("x = y^{2}"), "x = y^{2}");
  assert.strictEqual(postProcessLatex("Q K^{T}"), "Q K^{T}");
});

test("postProcessLatex: handles mixed text and structure", () => {
  const input = "A t t e n t i o n \\left(Q , K , V\\right) = s o f t m a x \\left(\\frac{Q K^{T}}{\\sqrt{d_{k}}}\\right) V";
  const result = postProcessLatex(input);
  assert.ok(result.includes("\\text{Attention}"));
  assert.ok(result.includes("\\text{softmax}"));
  assert.ok(result.includes("\\frac{Q K^{T}}{\\sqrt{d_{k}}}"));
});

test("postProcessLatex: does not touch already-wrapped \\text{}", () => {
  const input = "\\text{hello}";
  assert.strictEqual(postProcessLatex(input), input);
});

test("postProcessLatex: removes trailing formula number \\# \\left（2.1\\right）", () => {
  const input = "\\text{Attention} \\left(Q\\right) V \\# \\left（2 . 1\\right）";
  const result = postProcessLatex(input);
  assert.ok(!result.includes("\\#"));
  assert.ok(!result.includes("2 . 1"));
  assert.ok(result.includes("\\text{Attention}"));
});

test("postProcessLatex: removes trailing formula number \\# \\left(\\right. 2.2 ...)", () => {
  const input = "\\hat{a} \\cdot \\hat{b} \\# \\left(\\right. 2 . 2 \\left.\\right)";
  const result = postProcessLatex(input);
  assert.ok(!result.includes("\\#"));
  assert.ok(result.includes("\\hat{a}"));
});

test("postProcessLatex: cleans &nbsp; HTML entity", () => {
  const input = "\\frac{v}{&nbsp; \\left\\|v\\right\\|_{2}}";
  const result = postProcessLatex(input);
  assert.ok(!result.includes("&nbsp;"));
  assert.ok(result.includes("\\frac{v}"));
});

test("postProcessLatex: normalizes Unicode ‖ to \\|", () => {
  const input = "\\left‖a\\right‖";
  assert.strictEqual(postProcessLatex(input), "\\left\\|a\\right\\|");
});

// ---------------------------------------------------------------------------
// attachMathToStyleAst
// ---------------------------------------------------------------------------

test("attachMathToStyleAst: matches by text and assigns math_latex", () => {
  const styleAst: DocxStyleAstNode[] = [
    { text: "第一段无公式" },
    { text: "其中为平方关系" },
    { text: "第三段" },
  ];
  const fragments = [
    { paragraphText: "其中为平方关系", latex: ["x = y^{2}"], display: false },
  ];
  const count = attachMathToStyleAst(styleAst, fragments);
  assert.strictEqual(count, 1);
  assert.deepStrictEqual(styleAst[1].math_latex, ["x = y^{2}"]);
  assert.strictEqual(styleAst[0].math_latex, undefined);
  assert.strictEqual(styleAst[2].math_latex, undefined);
});

test("attachMathToStyleAst: matches empty-text paragraphs (display formula)", () => {
  const styleAst: DocxStyleAstNode[] = [
    { text: "前文" },
    { text: "" },
    { text: "后文" },
  ];
  const fragments = [
    { paragraphText: "", latex: ["E = m c^{2}"], display: true },
  ];
  const count = attachMathToStyleAst(styleAst, fragments);
  assert.strictEqual(count, 1);
  assert.deepStrictEqual(styleAst[1].math_latex, ["E = m c^{2}"]);
});

// ---------------------------------------------------------------------------
// appendMathToMarkdown
// ---------------------------------------------------------------------------

test("appendMathToMarkdown: inline formula appended to matching line", () => {
  const md = "# 标题\n\n其中为平方关系\n\n后续内容";
  const fragments = [
    { paragraphText: "其中为平方关系", latex: ["x = y^{2}"], display: false },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.includes("其中为平方关系 $x = y^{2}$"));
  assert.ok(!result.includes("本文中的数学公式"));
});

test("appendMathToMarkdown: display formula inserted after prevText line", () => {
  const md = "# 标题\n\n计算公式如下：\n\n其中 m 为质量";
  const fragments = [
    { paragraphText: "", latex: ["E = mc^{2}"], display: true, prevText: "计算公式如下：" },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.includes("计算公式如下：\n\n$$E = mc^{2}$$"));
  assert.ok(!result.includes("本文中的数学公式"));
});

test("appendMathToMarkdown: unmatched formulas fall back to appendix", () => {
  const md = "# 标题\n\n正文内容";
  const fragments = [
    { paragraphText: "", latex: ["E = mc^{2}"], display: true },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.includes("本文中的数学公式"));
  assert.ok(result.includes("$$E = mc^{2}$$"));
  assert.ok(result.includes("独立公式"));
});

test("appendMathToMarkdown: mixed inline + display + unmatched", () => {
  const md = [
    "# 第三章",
    "",
    "自注意力公式如下：",
    "",
    "其中Q=XW_Q表示查询",
    "",
    "后续分析",
  ].join("\n");
  const fragments = [
    { paragraphText: "", latex: ["\\text{Attention}(Q,K,V)"], display: true, prevText: "自注意力公式如下：" },
    { paragraphText: "其中Q=XW_Q表示查询", latex: ["Q = X W_{Q}"], display: false },
    { paragraphText: "找不到的段落", latex: ["\\alpha + \\beta"], display: false },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.includes("自注意力公式如下：\n\n$$\\text{Attention}(Q,K,V)$$"));
  assert.ok(result.includes("其中Q=XW_Q表示查询 $Q = X W_{Q}$"));
  assert.ok(result.includes("本文中的数学公式"));
  assert.ok(result.includes("$\\alpha + \\beta$"));
});

test("appendMathToMarkdown: matches prevText through Markdown bold markers", () => {
  const md = "# 章节\n\n__步骤3：归一化。__对向量进行归一化：\n\n后续内容";
  const fragments = [
    { paragraphText: "", latex: ["\\hat{v} = v"], display: true, prevText: "步骤3：归一化。对向量进行归一化：" },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.includes("$$\\hat{v} = v$$"));
  assert.ok(!result.includes("本文中的数学公式"));
});

test("appendMathToMarkdown: no fragments returns original", () => {
  const md = "# 标题\n\n正文";
  assert.strictEqual(appendMathToMarkdown(md, []), md);
});
