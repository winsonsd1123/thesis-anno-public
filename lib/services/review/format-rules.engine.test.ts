import test from "node:test";
import assert from "node:assert/strict";
import type { DocxStyleAstNode } from "@/lib/types/docx-hybrid";
import { compilePhysicalRules } from "@/lib/review/compile-physical-rules";
import { runPhysicalRuleEngine } from "@/lib/services/review/format-rules.engine";
import { formatEngineBaselineSchema } from "@/lib/schemas/format-engine-baseline.schema";
import { formatPhysicalExtractSchema } from "@/lib/schemas/format-physical-extract.schema";

const baseline = formatEngineBaselineSchema.parse({
  version: "1",
  heading_style_patterns: { "1": ["Heading1"] },
  size_tolerance_pt: 0.5,
});

test("runPhysicalRuleEngine flags wrong font on heading", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [{ level: 1, font: "黑体", size_pt: 16 }],
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "第一章 绪论",
      font: "宋体",
      size_pt: 16,
      paragraphStyleId: "Heading1",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].issue_type, "physical_layout_violation");
});

test("runPhysicalRuleEngine passes matching body", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "正文段落示例",
      font: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine does not flag cover-sized line as body (oversize skip)", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "中文论文题目：基于 Spring Boot 的文档管理系统",
      font: "宋体",
      size_pt: 16,
      paragraphStyleId: "Normal",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine skips body rule for Title-like paragraph style", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const baselineWithSkip = formatEngineBaselineSchema.parse({
    ...baseline,
    body_rule_skip_style_id_substrings: ["Title"],
    body_rule_oversize_skip_delta_pt: 0,
  });
  const nodes: DocxStyleAstNode[] = [
    {
      text: "论文题目一行",
      font: "宋体",
      size_pt: 14,
      paragraphStyleId: "Title",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baselineWithSkip);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine uses format fallback: heading font+size skips body rule", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [{ level: 1, font: "黑体", size_pt: 16, bold: true }],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "第一章 绪论",
      font: "黑体",
      size_pt: 16,
      bold: true,
      paragraphStyleId: "CustomChapterStyle",
    },
    {
      text: "正文内容示例",
      font: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const bodyIssues = issues.filter(
    (i) => i.analysis.includes("body-default") && i.quote_text.includes("绪论")
  );
  assert.equal(bodyIssues.length, 0, "heading by format should not trigger body rule");
  assert.equal(
    issues.filter((i) => i.quote_text.includes("正文内容")).length,
    0,
    "matching body should pass"
  );
});

test("run-level: mixed keyword paragraph detects wrong font in content runs", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "关键词：spring boot, redis stack，文档管理，自然语言处理",
      font: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      runs: [
        { text: "关键词：", font: "黑体", size_pt: 14 },
        { text: "spring boot, redis stack，文档管理，自然语言处理", font: "宋体", size_pt: 12 },
      ],
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const sizeIssues = issues.filter((i) => i.analysis.includes("段内字号不一致"));
  assert.equal(sizeIssues.length, 0, "label run (<=8 chars) is excluded from inconsistency check");
  const fontIssues = issues.filter((i) => i.analysis.includes("body-default") && i.analysis.includes("字体"));
  assert.equal(fontIssues.length, 0, "content runs match body font, no violation");
});

test("run-level: detects wrong font in long content runs", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "这是一段正文内容，其中包含了使用错误字体的长文本片段",
      font: "黑体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      runs: [
        { text: "这是一段正文内容，其中包含了使用错误字体的长文本片段", font: "黑体", size_pt: 12 },
      ],
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const fontIssues = issues.filter((i) => i.analysis.includes("字体"));
  assert.ok(fontIssues.length >= 1, "should flag wrong font on content run");
});

test("run-level: detects intra-paragraph size inconsistency", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "正文一段文本其中有部分大号文字插在中间不规范",
      font: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      runs: [
        { text: "正文一段文本其中有部分", font: "宋体", size_pt: 12 },
        { text: "大号文字插在中间不规范", font: "宋体", size_pt: 16 },
      ],
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const inconsistency = issues.filter((i) => i.analysis.includes("段内字号不一致"));
  assert.equal(inconsistency.length, 1, "should detect mixed sizes in body paragraph");
  const sizeViolations = issues.filter(
    (i) => i.analysis.includes("run 级") && i.analysis.includes("16pt")
  );
  assert.ok(sizeViolations.length >= 1, "should flag 16pt run as wrong size");
});

test("context: table_cell paragraphs are skipped entirely", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "表格内的文字内容不应被 body 规则检查",
      font: "黑体",
      size_pt: 10,
      paragraphStyleId: "Normal",
      context: "table_cell",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0, "table_cell should skip all rules");
});

test("context: caption paragraphs match caption rule, not body", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
    caption: { font: "宋体", size_pt: 10.5 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "图1-1 系统架构图",
      font: "宋体",
      size_pt: 10.5,
      paragraphStyleId: "Caption",
      context: "caption",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0, "matching caption should pass");
});

test("context: caption with wrong font is flagged", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [],
    body: { font: "宋体", size_pt: 12 },
    caption: { font: "宋体", size_pt: 10.5 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "表2-1 实验数据对比",
      font: "黑体",
      size_pt: 10.5,
      paragraphStyleId: "Caption",
      context: "caption",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const fontIssues = issues.filter((i) => i.analysis.includes("caption-default") && i.analysis.includes("字体"));
  assert.equal(fontIssues.length, 1, "wrong font on caption should be flagged");
});
