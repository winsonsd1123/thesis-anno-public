import assert from "node:assert";
import { test } from "node:test";
import {
  extractMathFragments,
  attachMathToStyleAst,
  appendMathToMarkdown,
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

test("appendMathToMarkdown: appends formula appendix", () => {
  const md = "# 标题\n\n正文内容";
  const fragments = [
    { paragraphText: "其中为平方关系", latex: ["x = y^{2}"], display: false },
    { paragraphText: "", latex: ["E = m c^{2}"], display: true },
  ];
  const result = appendMathToMarkdown(md, fragments);
  assert.ok(result.startsWith(md));
  assert.ok(result.includes("$x = y^{2}$"));
  assert.ok(result.includes("$$E = m c^{2}$$"));
  assert.ok(result.includes("独立公式"));
});

test("appendMathToMarkdown: no fragments returns original", () => {
  const md = "# 标题\n\n正文";
  assert.strictEqual(appendMathToMarkdown(md, []), md);
});
