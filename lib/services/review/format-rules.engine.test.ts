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

test("runPhysicalRuleEngine flags wrong font_zh on heading", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", size_pt: 16 }],
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "第一章 绪论",
      font_zh: "宋体",
      size_pt: 16,
      paragraphStyleId: "Heading1",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].issue_type, "physical_layout_violation");
  assert.equal(issues[0].paragraph_index, 0);
  assert.equal(issues[0].document_partition, "main_body");
  assert.equal(issues[0].paragraph_context, "body");
  assert.equal(issues[0].paragraph_style_id, "Heading1");
});

test("runPhysicalRuleEngine flags wrong font_en on heading", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_en: "Times New Roman", size_pt: 16 }],
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "Chapter 1 Introduction",
      font_en: "Arial",
      size_pt: 16,
      paragraphStyleId: "Heading1",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.ok(issues.length >= 1);
  assert.ok(issues[0].analysis.includes("西文字体"));
});

test("runPhysicalRuleEngine passes matching body", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "正文段落示例",
      font_zh: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine does not flag cover-sized line as body (oversize skip)", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "中文论文题目：基于 Spring Boot 的文档管理系统",
      font_zh: "宋体",
      size_pt: 16,
      paragraphStyleId: "Normal",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine skips body rule for Title-like paragraph style", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
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
      font_zh: "宋体",
      size_pt: 14,
      paragraphStyleId: "Title",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baselineWithSkip);
  assert.equal(issues.length, 0);
});

test("runPhysicalRuleEngine uses format fallback: heading font+size skips body rule", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", size_pt: 16, bold: true }],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "第一章 绪论",
      font_zh: "黑体",
      size_pt: 16,
      bold: true,
      paragraphStyleId: "CustomChapterStyle",
      partition: "main_body",
    },
    {
      text: "正文内容示例",
      font_zh: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      partition: "main_body",
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

test("partition: front_cover and toc are skipped from body rules", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "封面论文标题应该被跳过",
      font_zh: "黑体",
      size_pt: 22,
      partition: "front_cover",
    },
    {
      text: "目录条目也被跳过",
      font_zh: "楷体",
      size_pt: 14,
      partition: "toc",
    }
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0, "front_cover and toc should be skipped");
});

test("partition: abstract falls back to NOT matching main_body rules", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "摘要正文内容（由于没有配abstract规则，所以不查，也不吃body规则）",
      font_zh: "楷体",
      size_pt: 14,
      partition: "abstract",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0, "abstract should not match body-default");
});

test("run-level: mixed keyword paragraph detects wrong font in content runs", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "关键词：spring boot, redis stack，文档管理，自然语言处理",
      font_zh: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      partition: "main_body",
      runs: [
        { text: "关键词：", font_zh: "黑体", size_pt: 14 },
        { text: "spring boot, redis stack，文档管理，自然语言处理", font_zh: "宋体", size_pt: 12 },
      ],
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const sizeIssues = issues.filter((i) => i.analysis.includes("段内字号不一致"));
  assert.equal(sizeIssues.length, 0, "label run (<=8 chars) is excluded from inconsistency check");
  const fontIssues = issues.filter((i) => i.analysis.includes("body-default") && i.analysis.includes("字体"));
  assert.equal(fontIssues.length, 0, "content runs match body font, no violation");
});

test("run-level: detects wrong font_zh in long content runs", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "这是一段正文内容，其中包含了使用错误字体的长文本片段",
      font_zh: "黑体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      partition: "main_body",
      runs: [
        { text: "这是一段正文内容，其中包含了使用错误字体的长文本片段", font_zh: "黑体", size_pt: 12 },
      ],
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const fontIssues = issues.filter((i) => i.analysis.includes("中文字体"));
  assert.ok(fontIssues.length >= 1, "should flag wrong font_zh on content run");
});

test("run-level: detects intra-paragraph size inconsistency", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "正文一段文本其中有部分大号文字插在中间不规范",
      font_zh: "宋体",
      size_pt: 12,
      paragraphStyleId: "Normal",
      partition: "main_body",
      runs: [
        { text: "正文一段文本其中有部分", font_zh: "宋体", size_pt: 12 },
        { text: "大号文字插在中间不规范", font_zh: "宋体", size_pt: 16 },
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
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "表格内的文字内容不应被 body 规则检查",
      font_zh: "黑体",
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
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
    caption: { font_zh: "宋体", size_pt: 10.5 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "图1-1 系统架构图",
      font_zh: "宋体",
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
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12 },
    caption: { font_zh: "宋体", size_pt: 10.5 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "表2-1 实验数据对比",
      font_zh: "黑体",
      size_pt: 10.5,
      paragraphStyleId: "Caption",
      context: "caption",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const fontIssues = issues.filter((i) => i.analysis.includes("caption-default") && i.analysis.includes("中文字体"));
  assert.equal(fontIssues.length, 1, "wrong font on caption should be flagged");
  assert.equal(fontIssues[0].paragraph_index, 0);
  assert.equal(fontIssues[0].paragraph_context, "caption");
  assert.ok(
    fontIssues[0].quote_text.includes("表2-1"),
    "caption quote should retain full short caption text, not a 1-char slice"
  );
});

test("context: references 段落不跑物理规则（即使 context 为 references）", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    references: { font_zh: "宋体", size_pt: 10.5 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "[1] 张三. 论文标题[J]. 期刊名, 2024.",
      font_zh: "宋体",
      size_pt: 18,
      paragraphStyleId: "Normal",
      context: "references",
      partition: "references",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0);
});

test("context: footnotes paragraphs match footnotes rule", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    footnotes: { font_zh: "宋体", size_pt: 9 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "这是一条脚注文本内容",
      font_zh: "宋体",
      size_pt: 9,
      paragraphStyleId: "FootnoteText",
      context: "footnotes",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.equal(issues.length, 0, "matching footnotes should pass");
});

test("context: footnotes with wrong font is flagged", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    footnotes: { font_zh: "宋体", size_pt: 9 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "这是一条脚注文本内容",
      font_zh: "黑体",
      size_pt: 9,
      paragraphStyleId: "FootnoteText",
      context: "footnotes",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  assert.ok(issues.length >= 1, "wrong font on footnotes should be flagged");
  assert.ok(issues[0].analysis.includes("footnotes-default"));
});

test("heading size: Word 内置 22pt 与规范 16pt 在 heading_size_tolerance_pt 下不报字号", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", size_pt: 16, bold: true }],
  });
  const program = compilePhysicalRules(baseline, extract);
  const loose = formatEngineBaselineSchema.parse({
    ...baseline,
    heading_size_tolerance_pt: 7,
  });
  const nodes: DocxStyleAstNode[] = [
    {
      text: "绪论",
      font_zh: "黑体",
      size_pt: 22,
      paragraphStyleId: "Heading1",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, loose);
  const sizeIssues = issues.filter((i) => i.analysis.includes("期望约"));
  assert.equal(sizeIssues.length, 0);
});

test("body: space_before_lines 与规则不符时报 physical_layout_violation", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 2, font_zh: "黑体", size_pt: 15, space_before_lines: 0.5, space_after_lines: 0.5 }],
  });
  const program = compilePhysicalRules(baseline, extract);

  // 模拟 Word：0.5行，字号15pt，实际存储可能被解析出 pt，也可能解析出 lines。
  // 情况1：AST 成功解析出 space_before_lines = 0.5，正常通过
  const nodesOk: DocxStyleAstNode[] = [
    {
      text: "二级标题正常匹配 lines",
      font_zh: "黑体",
      size_pt: 15,
      space_before_lines: 0.5,
      space_after_lines: 0.5,
      paragraphStyleId: "Heading2",
      partition: "main_body",
    },
  ];
  assert.equal(runPhysicalRuleEngine(nodesOk, program, baseline).length, 0);

  // 情况2：AST 仅解析出 space_before_pt = 7.8（即 15 * 1.04 * 0.5），应该被换算后视作 0.5行 容差内通过
  const nodesPtOk: DocxStyleAstNode[] = [
    {
      text: "二级标题只有 pt 7.8",
      font_zh: "黑体",
      size_pt: 15,
      space_before_pt: 7.8, // 7.8 / (15*1.04) = 7.8 / 15.6 = 0.5
      space_after_pt: 7.8,
      paragraphStyleId: "Heading2",
      partition: "main_body",
    },
  ];
  assert.equal(runPhysicalRuleEngine(nodesPtOk, program, baseline).length, 0);

  // 情况3：AST 解析出的 pt 完全不对（比如 15.6pt 也就是 1 行），应当报错
  const nodesFail: DocxStyleAstNode[] = [
    {
      text: "二级标题行距错误",
      font_zh: "黑体",
      size_pt: 15,
      space_before_pt: 15.6, // ≈ 1 行
      space_after_lines: 0.5,
      paragraphStyleId: "Heading2",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodesFail, program, baseline);
  const failIssues = issues.filter((i) => i.analysis.includes("段前约 0.5 行"));
  assert.equal(failIssues.length, 1);
  assert.ok(failIssues[0].analysis.includes("实际约 1.00 行"));
});

test("body: line_spacing_pt 与规则不符时报 physical_layout_violation", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    body: { font_zh: "宋体", size_pt: 12, line_spacing_pt: 22 },
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "正文应固定行距二十二磅",
      font_zh: "宋体",
      size_pt: 12,
      line_spacing_pt: 18,
      paragraphStyleId: "Normal",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const sp = issues.filter((i) => i.analysis.includes("行距"));
  assert.equal(sp.length, 1);
  assert.ok(sp[0].analysis.includes("22"));
});

test("heading bold: AST 未解析出 bold（undefined）时不报未加粗", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", size_pt: 16, bold: true }],
  });
  const program = compilePhysicalRules(baseline, extract);
  const nodes: DocxStyleAstNode[] = [
    {
      text: "绪论",
      font_zh: "黑体",
      size_pt: 16,
      paragraphStyleId: "Heading1",
      partition: "main_body",
    },
  ];
  const issues = runPhysicalRuleEngine(nodes, program, baseline);
  const boldIssues = issues.filter((i) => i.analysis.includes("加粗"));
  assert.equal(boldIssues.length, 0);
});
