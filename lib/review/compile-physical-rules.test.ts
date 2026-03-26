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
    schema_version: "1",
    headings: [{ level: 1, font: "黑体", size_pt: 16, bold: true }],
    body: { font: "宋体", size_pt: 12 },
  });
  const p = compilePhysicalRules(baseline, extract);
  assert.equal(p.rules.length, 2);
  assert.ok(p.rules.some((r) => r.id.startsWith("heading-L1")));
  assert.ok(p.rules.some((r) => r.id === "body-default"));
});

test("compilePhysicalRules records dropped line spacing hints", () => {
  const extract = formatPhysicalExtractSchema.parse({
    schema_version: "1",
    headings: [{ level: 2, size_pt: 15, line_spacing_pt: 22 }],
  });
  const p = compilePhysicalRules(baseline, extract);
  assert.ok(p.dropped_unsupported.some((s) => s.includes("line_spacing")));
});
