import { z } from "zod";
import { generateObject, zodSchema } from "ai";
import { getLLMModel } from "@/lib/integrations/openrouter";
import type { DocxStyleAstNode } from "@/lib/types/docx-hybrid";
import {
  formatPhysicalExtractSchema,
  type FormatPhysicalExtract,
} from "@/lib/schemas/format-physical-extract.schema";
import type { FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";
import { compilePhysicalRules } from "@/lib/review/compile-physical-rules";
import { runPhysicalRuleEngine } from "@/lib/services/review/format-rules.engine";
import { buildReviewMessages } from "./review-messages";
import { ReviewEngineError } from "./review-errors";

export type ReviewContentType = "base64" | "text";

/** 由编排层注入；`analyzeLogic` 必填。 */
export type LogicReviewContextPayload = {
  modelConfig: { model: string; temperature: number };
  pass1SystemPrompt: string;
  pass2TemplateRaw: string;
};

/** 由编排层注入；`analyzeAiTraceChunk`（经 genericLlmBatchTask）必填。 */
export type AiTraceContextPayload = {
  modelConfig: { model: string; temperature: number };
  promptTemplate: string;
};

/** 由编排层注入；`extractReferences` 必填。 */
export type ReferenceExtractContextPayload = {
  modelConfig: { model: string; temperature: number };
  promptTemplate: string;
};

/** 由编排层注入；`verifyReferenceBatch` 必填。 */
export type ReferenceVerifyContextPayload = {
  modelConfig: {
    model: string;
    temperature: number;
    model_zh?: string;
  };
  promptTemplate: string;
  batchSize: number;
};

export type FormatSemanticContextPayload = {
  modelConfig: { model: string; temperature: number };
  promptTemplate: string;
};

export type FormatExtractContextPayload = {
  modelConfig: { model: string; temperature: number };
  promptTemplate: string;
};

export type FormatReviewContextPayload = {
  /** 与 reviews.format_guidelines 一致 */
  formatGuidelines: string;
  semantic: FormatSemanticContextPayload;
  extract: FormatExtractContextPayload;
  engineBaseline: FormatEngineBaseline;
};

export type ReviewAnalyzeContext = {
  domain: string | null;
  logicReview?: LogicReviewContextPayload;
  aiTrace?: AiTraceContextPayload;
  referenceExtract?: ReferenceExtractContextPayload;
  referenceVerify?: ReferenceVerifyContextPayload;
  formatReview?: FormatReviewContextPayload;
};

const semanticIssueSchema = z.object({
  chapter: z.string(),
  quote_text: z.string(),
  issue_type: z.enum([
    "terminology_inconsistency",
    "heading_hierarchy_error",
    "figure_table_mismatch",
    "structural_missing",
    "typo_and_grammar",
  ]),
  severity: z.enum(["High", "Medium", "Low"]),
  analysis: z.string(),
  suggestion: z.string(),
});

const FormatSemanticResultSchema = z.object({
  issues: z.array(semanticIssueSchema),
});

export type FormatSemanticIssue = z.infer<typeof semanticIssueSchema>;

export type FormatReviewIssue = FormatSemanticIssue | PhysicalMergedIssue;

type PhysicalMergedIssue = {
  chapter: string;
  quote_text: string;
  issue_type: "physical_layout_violation";
  severity: "High" | "Medium" | "Low";
  analysis: string;
  suggestion: string;
};

export type FormatReviewObservability = {
  semantic_llm_ms: number;
  spec_extract_ms: number;
  rules_ms: number;
  spec_extract_ok: boolean;
  semantic_model_id: string;
  extract_model_id: string;
  baseline_version: string;
  semantic_issue_count: number;
  physical_issue_count: number;
  compile_dropped_count: number;
  /** NL→JSON 物理规格抽取结果（与 compile 输入一致）；便于调试与落库查看 */
  physical_extract: FormatPhysicalExtract;
};

export type FormatReviewResult = {
  issues: FormatReviewIssue[];
  observability: FormatReviewObservability;
};

function failFormat(phase: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new ReviewEngineError(`format review ${phase} failed: ${msg}`, e);
}

/**
 * 双轨：语义轨（高级模型 + Markdown）与 NL→Extract→compile→物理规则引擎（styleAst）。
 */
export async function analyzeFormat(
  markdown: string,
  styleAst: DocxStyleAstNode[],
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext
): Promise<FormatReviewResult> {
  const fr = ctx.formatReview;
  if (!fr) {
    throw new ReviewEngineError(
      "format review: missing formatReview on context (orchestrator must inject)"
    );
  }

  const semanticModel = getLLMModel(fr.semantic.modelConfig.model);
  const extractModel = getLLMModel(fr.extract.modelConfig.model);
  const semanticSystem = fr.semantic.promptTemplate.replace(
    "{{format_guidelines}}",
    fr.formatGuidelines
  );

  const semanticSchema = zodSchema(FormatSemanticResultSchema);
  const extractSchema = zodSchema(formatPhysicalExtractSchema);

  const extractUserText = `以下为用户提供的论文格式要求（自然语言）。请仅依据文中**明确写出**的约束抽取结构化字段；禁止臆造未出现的规则。\n\n---\n${fr.formatGuidelines}`;

  const tSem0 = performance.now();
  const tExt0 = performance.now();

  let semanticResult: z.infer<typeof FormatSemanticResultSchema>;
  let extractResult: z.infer<typeof formatPhysicalExtractSchema>;

  try {
    [semanticResult, extractResult] = await Promise.all([
      generateObject({
        model: semanticModel,
        temperature: fr.semantic.modelConfig.temperature,
        system: semanticSystem,
        messages: buildReviewMessages(markdown, contentType),
        schema: semanticSchema,
      }).then((r) => r.object),
      generateObject({
        model: extractModel,
        temperature: fr.extract.modelConfig.temperature,
        system: fr.extract.promptTemplate,
        messages: [{ role: "user", content: extractUserText }],
        schema: extractSchema,
      }).then((r) => r.object),
    ]);
  } catch (e) {
    failFormat("parallel_llm", e);
  }

  const semantic_llm_ms = Math.round(performance.now() - tSem0);
  const spec_extract_ms = Math.round(performance.now() - tExt0);

  let physicalIssues: PhysicalMergedIssue[] = [];
  let rules_ms = 0;
  let spec_extract_ok = true;
  const tRules = performance.now();
  const program = compilePhysicalRules(fr.engineBaseline, extractResult);

  if (process.env.FORMAT_PHYSICAL_EXTRACT_LOG === "1") {
    console.info(
      "[analyzeFormat] physical_extract JSON:\n%s",
      JSON.stringify(extractResult, null, 2)
    );
  }

  try {
    if (program.rules.length > 0) {
      physicalIssues = runPhysicalRuleEngine(styleAst, program, fr.engineBaseline) as PhysicalMergedIssue[];
    }
  } catch (e) {
    spec_extract_ok = false;
    console.warn("[analyzeFormat] physical rules skipped:", e);
  }

  rules_ms = Math.round(performance.now() - tRules);
  const compile_dropped_count = program.dropped_unsupported.length;

  const issues: FormatReviewIssue[] = [...semanticResult.issues, ...physicalIssues];

  const observability: FormatReviewObservability = {
    semantic_llm_ms,
    spec_extract_ms,
    rules_ms,
    spec_extract_ok,
    semantic_model_id: fr.semantic.modelConfig.model,
    extract_model_id: fr.extract.modelConfig.model,
    baseline_version: fr.engineBaseline.version,
    semantic_issue_count: semanticResult.issues.length,
    physical_issue_count: physicalIssues.length,
    compile_dropped_count,
    physical_extract: extractResult,
  };

  return { issues, observability };
}
