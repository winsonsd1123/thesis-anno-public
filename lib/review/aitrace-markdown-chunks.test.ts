import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AITRACE_DEFAULT_SECTION_LABEL,
  buildAiTraceChunksFromMarkdown,
} from "./aitrace-markdown-chunks";

describe("buildAiTraceChunksFromMarkdown", () => {
  it("returns empty array for blank markdown", () => {
    assert.deepEqual(buildAiTraceChunksFromMarkdown(""), []);
    assert.deepEqual(buildAiTraceChunksFromMarkdown("   \n\n  "), []);
  });

  it("labels body paragraphs under default section", () => {
    const chunks = buildAiTraceChunksFromMarkdown("第一段\n\n第二段", 2000);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.includes(`--- [${AITRACE_DEFAULT_SECTION_LABEL} - 第 1 段] ---`));
    assert.ok(chunks[0]?.includes(`--- [${AITRACE_DEFAULT_SECTION_LABEL} - 第 2 段] ---`));
    assert.ok(chunks[0]?.includes("第一段"));
    assert.ok(chunks[0]?.includes("第二段"));
  });

  it("resets paragraph index when section heading changes", () => {
    const md = "# 绪论\n\nhello\n\n# 方法\n\nworld";
    const chunks = buildAiTraceChunksFromMarkdown(md, 2000);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.includes("--- [绪论 - 第 1 段] ---"));
    assert.ok(chunks[0]?.includes("--- [方法 - 第 1 段] ---"));
  });

  it("handles heading and body in one block", () => {
    const md = "# 标题\n正文续在同一\n块";
    const chunks = buildAiTraceChunksFromMarkdown(md, 2000);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.includes("--- [标题 - 第 1 段] ---"));
    assert.ok(chunks[0]?.includes("正文续在同一\n块"));
  });

  it("splits at paragraph boundary near maxChars", () => {
    const p1 = "a".repeat(100);
    const p2 = "b".repeat(100);
    const p3 = "c".repeat(100);
    const md = `${p1}\n\n${p2}\n\n${p3}`;
    const chunks = buildAiTraceChunksFromMarkdown(md, 250);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0]?.includes("第 1 段] ---"));
    assert.ok(chunks[0]?.includes("第 2 段] ---"));
    assert.ok(chunks[1]?.includes("第 3 段] ---"));
  });

  it("does not split oversized single paragraph mid-text", () => {
    const long = "x".repeat(3000);
    const chunks = buildAiTraceChunksFromMarkdown(long, 2000);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.length > 2000);
    assert.ok(chunks[0]?.includes("第 1 段] ---"));
    assert.ok(chunks[0]?.endsWith(long));
  });
});
