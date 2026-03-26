import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractReferencesFromMarkdown,
  findLastBibliographyBodyStart,
  findLastBibliographyHeadingLineStart,
  isBibliographyHeadingLine,
} from "./reference-markdown-extract";

describe("isBibliographyHeadingLine", () => {
  it("accepts markdown headings and plain lines", () => {
    assert.equal(isBibliographyHeadingLine("## 参考文献"), true);
    assert.equal(isBibliographyHeadingLine("### References"), true);
    assert.equal(isBibliographyHeadingLine("Works Cited"), true);
    assert.equal(isBibliographyHeadingLine("参 考 文 献"), true);
    assert.equal(isBibliographyHeadingLine("Bibliography："), true);
  });

  it("rejects non-heading lines", () => {
    assert.equal(isBibliographyHeadingLine("正文提到参考文献一词"), false);
    assert.equal(isBibliographyHeadingLine(""), false);
  });
});

describe("findLastBibliographyHeadingLineStart", () => {
  it("uses the last matching heading when earlier text mentions 参考文献", () => {
    const md = `绪论\n参考文献在脚注中\n\n## 参考文献\n\n[1] A. Test. Journal. 2020.\n`;
    const hi = findLastBibliographyHeadingLineStart(md);
    assert.ok(hi !== null);
    assert.equal(md.slice(hi).startsWith("## 参考文献"), true);
  });

  it("handles CRLF offsets", () => {
    const md = "a\r\n## References\r\n\r\n[1] One.\r\n";
    const start = findLastBibliographyBodyStart(md);
    assert.ok(start !== null);
    assert.ok(md.slice(start).trimStart().startsWith("[1]"));
  });
});

describe("extractReferencesFromMarkdown", () => {
  it("splits numbered bracket entries", () => {
    const md = `
# Paper

## 参考文献

[1] 张三. 某论文研究[J]. 期刊名, 2020, 1(1): 1-10.
[2] Smith J. Deep Learning[M]. Springer, 2019.
`;
    const refs = extractReferencesFromMarkdown(md);
    assert.equal(refs.length, 2);
    assert.equal(refs[0]!.id, 1);
    assert.ok(refs[0]!.rawText.includes("张三"));
    assert.ok(refs[1]!.rawText.includes("Smith"));
  });

  it("parses spaced heading 参 考 文 献", () => {
    const md = `## 参 考 文 献

[1] Lee B. Title here[J]. Journal, 2021.`;
    const refs = extractReferencesFromMarkdown(md);
    assert.equal(refs.length, 1);
    assert.ok(refs[0]!.rawText.includes("Lee"));
  });

  it("parses Works Cited", () => {
    const md = `Works Cited

[1] Doe J. Article. 2022.`;
    const refs = extractReferencesFromMarkdown(md);
    assert.equal(refs.length, 1);
  });

  it("returns empty when no bibliography section", () => {
    assert.deepEqual(extractReferencesFromMarkdown("只有正文没有列表"), []);
  });

  it("splits multiple [n] on one line", () => {
    const md = `## 参考文献

[1] First ref. [2] Second ref.`;
    const refs = extractReferencesFromMarkdown(md);
    assert.equal(refs.length, 2);
    assert.ok(refs[0]!.rawText.includes("First"));
    assert.ok(refs[1]!.rawText.includes("Second"));
  });
});
