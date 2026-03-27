/**
 * 对指定 docx 做：分区统计 + 手动 PhysicalExtract 跑物理轨（不调用 LLM）
 * 用法: pnpm exec tsx scripts/simulate-physical-on-docx.ts <论文.docx>
 */
import { readFileSync } from "node:fs";
import { parseHybridDocx } from "../lib/review/hybrid-docx-parser";
import { compilePhysicalRules } from "../lib/review/compile-physical-rules";
import { runPhysicalRuleEngine } from "../lib/services/review/format-rules.engine";
import { formatEngineBaselineSchema } from "../lib/schemas/format-engine-baseline.schema";
import { formatPhysicalExtractSchema } from "../lib/schemas/format-physical-extract.schema";

const path = process.argv[2];
if (!path) {
  console.error("用法: pnpm exec tsx scripts/simulate-physical-on-docx.ts <论文.docx>");
  process.exit(1);
}

const baseline = formatEngineBaselineSchema.parse({
  version: "1",
  heading_style_patterns: {
    "1": ["Heading1", "heading1", "标题1", "标题 1", "章标题", "一级标题", "ChapterTitle", "TOC1"],
    "2": ["Heading2", "heading2", "标题2", "标题 2", "节标题", "二级标题", "SectionTitle", "TOC2"],
    "3": ["Heading3", "heading3", "标题3", "标题 3", "三级标题", "小节标题", "SubSectionTitle", "TOC3"],
    "4": ["Heading4", "heading4", "标题4", "标题 4", "四级标题", "TOC4"],
  },
  size_tolerance_pt: 0.5,
  body_rule_skip_style_id_substrings: [
    "Title",
    "title",
    "Subtitle",
    "subtitle",
    "DocTitle",
    "标题",
    "题注",
    "Caption",
  ],
  body_rule_oversize_skip_delta_pt: 2.5,
});

/** 从你给的传媒大学规范里抽的「尺子」近似值（小四=12，小三=15，三号=16，四号=14，五号=10.5） */
const cucExtract = formatPhysicalExtractSchema.parse({
  schema_version: "2",
  headings: [
    { level: 1, font_zh: "黑体", size_pt: 16 },
    { level: 2, font_zh: "黑体", size_pt: 15 },
    { level: 3, font_zh: "黑体", size_pt: 14 },
    { level: 4, font_zh: "黑体", size_pt: 12 },
  ],
  body: { font_zh: "宋体", size_pt: 12 },
  caption: { font_zh: "宋体", size_pt: 10.5 },
  references: { font_zh: "宋体", size_pt: 12 },
});

async function main() {
  const buf = readFileSync(path);
  const r = await parseHybridDocx(buf);
  const ast = r.styleAst;

  const hist: Record<string, number> = {};
  for (const n of ast) {
    const p = n.partition ?? "(undefined)";
    hist[p] = (hist[p] ?? 0) + 1;
  }
  console.log("\n=== partition 段落计数 ===");
  console.log(JSON.stringify(hist, null, 2));

  const mainBody = ast.filter((n) => n.partition === "main_body" && n.text.trim().length > 0);
  console.log("\n=== main_body 非空段落数 ===", mainBody.length);

  const program = compilePhysicalRules(baseline, cucExtract);
  const issues = runPhysicalRuleEngine(ast, program, baseline);
  console.log("\n=== 物理轨问题数（手动尺子）===", issues.length);
  for (const it of issues.slice(0, 25)) {
    console.log(
      `- [${it.chapter}] quote="${it.quote_text.slice(0, 36)}${it.quote_text.length > 36 ? "…" : ""}" | ${it.analysis.slice(0, 80)}…`
    );
  }
  if (issues.length > 25) console.log(`  … 另有 ${issues.length - 25} 条`);

  // 抽样：各分区前 3 条非空
  console.log("\n=== 各分区抽样（text 前 40 字）===");
  for (const part of ["front_cover", "abstract", "toc", "main_body", "references", "end_matter"] as const) {
    const samples = ast.filter((n) => n.partition === part && n.text.trim().length > 0).slice(0, 3);
    console.log(`\n[${part}] count=${hist[part] ?? 0}`);
    for (const n of samples) {
      console.log(
        `  style=${n.paragraphStyleId ?? "–"} ol=${n.outlineLevel ?? "–"} ctx=${n.context} sz=${n.size_pt ?? "–"} 「${n.text.trim().slice(0, 40)}」`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
