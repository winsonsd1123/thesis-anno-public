import type { FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";
import type { FormatPhysicalExtract } from "@/lib/schemas/format-physical-extract.schema";

export type ParagraphMatch =
  | { kind: "heading_level"; level: number }
  | { kind: "body" }
  | { kind: "caption" };

export type CompiledParagraphRule = {
  id: string;
  match: ParagraphMatch;
  fontAllowlist?: string[];
  sizePt?: number;
  bold?: boolean;
};

export type PhysicalRuleProgram = {
  baseline_version: string;
  rules: CompiledParagraphRule[];
  dropped_unsupported: string[];
};

export function compilePhysicalRules(
  baseline: FormatEngineBaseline,
  extract: FormatPhysicalExtract
): PhysicalRuleProgram {
  const dropped: string[] = [...(extract.notes_unenforceable ?? [])];
  const rules: CompiledParagraphRule[] = [];
  let rid = 0;

  for (const h of extract.headings) {
    rules.push({
      id: `heading-L${h.level}-${++rid}`,
      match: { kind: "heading_level", level: h.level },
      fontAllowlist: h.font ? [h.font] : undefined,
      sizePt: h.size_pt,
      bold: h.bold,
    });
    if (h.line_spacing_pt !== undefined) {
      dropped.push(`heading L${h.level}: line_spacing_pt=${h.line_spacing_pt} (no AST)`);
    }
  }

  if (extract.body && (extract.body.font || extract.body.size_pt !== undefined)) {
    rules.push({
      id: "body-default",
      match: { kind: "body" },
      fontAllowlist: extract.body.font ? [extract.body.font] : undefined,
      sizePt: extract.body.size_pt,
    });
    if (extract.body.line_spacing_pt !== undefined) {
      dropped.push(`body: line_spacing_pt=${extract.body.line_spacing_pt} (no AST)`);
    }
  }

  if (extract.caption && (extract.caption.font || extract.caption.size_pt !== undefined)) {
    rules.push({
      id: "caption-default",
      match: { kind: "caption" },
      fontAllowlist: extract.caption.font ? [extract.caption.font] : undefined,
      sizePt: extract.caption.size_pt,
    });
  }

  return {
    baseline_version: baseline.version,
    rules,
    dropped_unsupported: dropped,
  };
}
