import test from "node:test";
import assert from "node:assert/strict";
import { compilePhysicalRules } from "@/lib/review/compile-physical-rules";
import { formatEngineBaselineSchema } from "@/lib/schemas/format-engine-baseline.schema";
import { formatPhysicalExtractSchema } from "@/lib/schemas/format-physical-extract.schema";

const baseline = formatEngineBaselineSchema.parse({
  version: "1",
  heading_style_patterns: { "1": ["Heading1"] },
  size_tolerance_pt: 0.5,
});

test("compilePhysicalRules merges heading + body from extract", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", size_pt: 16, bold: true }],
    body: { font_zh: "宋体", size_pt: 12 },
  });
  const p = compilePhysicalRules(baseline, extract);
  assert.equal(p.rules.length, 2);
  assert.ok(p.rules.some((r) => r.id.startsWith("heading-L1")));
  assert.ok(p.rules.some((r) => r.id === "body-default"));
});

test("compilePhysicalRules carries spacing into heading rule (no AST dropped)", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 2, size_pt: 15, line_spacing_pt: 22, indent_first_line_chars: 0 }],
  });
  const p = compilePhysicalRules(baseline, extract);
  const h = p.rules.find((r) => r.id.startsWith("heading-L2"));
  assert.ok(h);
  assert.equal(h.lineSpacingPt, 22);
  assert.equal(h.indentFirstLineChars, 0);
  assert.ok(!p.dropped_unsupported.some((s) => s.includes("line_spacing")));
});

test("compilePhysicalRules splits font_zh and font_en into separate allowlists", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [{ level: 1, font_zh: "黑体", font_en: "Arial", size_pt: 16 }],
  });
  const p = compilePhysicalRules(baseline, extract);
  const h = p.rules.find((r) => r.id.startsWith("heading-L1"));
  assert.ok(h);
  assert.deepEqual(h.fontAllowlistZh, ["黑体"]);
  assert.deepEqual(h.fontAllowlistEn, ["Arial"]);
});

test("compilePhysicalRules compiles footnotes rules (参考文献不生成物理规则)", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "2",
    headings: [],
    references: { font_zh: "宋体", size_pt: 10.5 },
    footnotes: { font_zh: "宋体", size_pt: 9 },
  });
  const p = compilePhysicalRules(baseline, extract);
  assert.ok(!p.rules.some((r) => r.id === "references-default"));
  assert.ok(p.rules.some((r) => r.id === "footnotes-default"));
  const fn = p.rules.find((r) => r.id === "footnotes-default")!;
  assert.equal(fn.sizePt, 9);
});
