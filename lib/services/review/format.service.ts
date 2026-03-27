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
import {
  extractGlobalSkeleton,
  splitMarkdownByChapters,
} from "@/lib/review/format-markdown-chunks";

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
  /** format_semantic_global_system.model_config */
  globalModelConfig: { model: string; temperature: number };
  /** format_semantic_local_system.model_config */
  localModelConfig: { model: string; temperature: number };
  /** format_semantic_global_system：仅查 structural_missing / heading_hierarchy_error */
  globalPromptTemplate: string;
  /** format_semantic_local_system：仅查 figure_table_mismatch / typo_and_grammar / terminology_inconsistency / ai_use_disclosure */
  localPromptTemplate: string;
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

const semanticIssueBaseSchema = z.object({
  chapter: z.string(),
  quote_text: z.string(),
  severity: z.enum(["High", "Medium", "Low"]),
  analysis: z.string(),
  suggestion: z.string(),
});

/** Global Pass：仅宏观结构类问题 */
const globalSemanticIssueSchema = semanticIssueBaseSchema.extend({
  issue_type: z.enum(["structural_missing", "heading_hierarchy_error"]),
});

const GlobalSemanticResultSchema = z.object({
  issues: z.array(globalSemanticIssueSchema),
});

/** Local Pass：仅局部微观问题 */
const localSemanticIssueSchema = semanticIssueBaseSchema.extend({
  issue_type: z.enum([
    "figure_table_mismatch",
    "typo_and_grammar",
    "terminology_inconsistency",
    /** 校规明确要求时：文中是否具备规定的 AI 使用披露（脚注/要素/说明表等）；不做「用没用 AI」推断（与 aitrace 无关） */
    "ai_use_disclosure",
  ]),
});

const LocalSemanticResultSchema = z.object({
  issues: z.array(localSemanticIssueSchema),
});

/** 合并后的完整语义 issue 类型 */
const semanticIssueSchema = z.discriminatedUnion("issue_type", [
  globalSemanticIssueSchema,
  localSemanticIssueSchema,
]);

export type FormatSemanticIssue = z.infer<typeof semanticIssueSchema>;

export type FormatReviewIssue = FormatSemanticIssue | PhysicalMergedIssue;

type PhysicalMergedIssue = {
  chapter: string;
  quote_text: string;
  issue_type: "physical_layout_violation";
  severity: "High" | "Medium" | "Low";
  analysis: string;
  suggestion: string;
  /** 与 styleAst 数组下标一致（0-based），便于在 Word/Markdown 中顺序定位 */
  paragraph_index?: number;
  document_partition?: string;
  paragraph_context?: string;
  paragraph_style_id?: string;
};

export type FormatReviewObservability = {
  semantic_llm_ms: number;
  spec_extract_ms: number;
  rules_ms: number;
  spec_extract_ok: boolean;
  /** @deprecated 与 global 一致；请用 semantic_global_model_id / semantic_local_model_id */
  semantic_model_id: string;
  semantic_global_model_id: string;
  semantic_local_model_id: string;
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

/** 抽取模型连续失败时的安全降级（仅语义轨 + 无物理规则） */
const EMPTY_PHYSICAL_EXTRACT: FormatPhysicalExtract = formatPhysicalExtractSchema.parse({
  schema_version: "2",
});

async function withRetries<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = opts?.attempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 700;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw last;
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

  const globalModelConfig = fr.semantic.globalModelConfig;
  const localModelConfig = fr.semantic.localModelConfig;
  const globalSemanticModel = getLLMModel(globalModelConfig.model);
  const localSemanticModel = getLLMModel(localModelConfig.model);
  const extractModel = getLLMModel(fr.extract.modelConfig.model);

  const globalSystem = fr.semantic.globalPromptTemplate.replace(
    "{{format_guidelines}}",
    fr.formatGuidelines
  );
  const localSystem = fr.semantic.localPromptTemplate.replace(
    "{{format_guidelines}}",
    fr.formatGuidelines
  );

  const globalSchema = zodSchema(GlobalSemanticResultSchema);
  const localSchema = zodSchema(LocalSemanticResultSchema);
  const extractSchema = zodSchema(formatPhysicalExtractSchema);

  const extractUserText = `以下为用户提供的论文格式要求（自然语言）。请仅依据文中**明确写出**的约束抽取结构化字段；禁止臆造未出现的规则。\n\n---\n${fr.formatGuidelines}`;

  const tSem0 = performance.now();
  const tExt0 = performance.now();

  // --- 构建 Global Task ---
  const globalSkeleton = extractGlobalSkeleton(markdown);
  const globalTask = withRetries(() =>
    generateObject({
      model: globalSemanticModel,
      temperature: globalModelConfig.temperature,
      system: globalSystem,
      messages: [{ role: "user", content: globalSkeleton }],
      schema: globalSchema,
    }).then((r) => r.object)
  );

  // --- 构建 Local Tasks（按章分块，每批 4 个并发，防 429）---
  const localChunks = splitMarkdownByChapters(markdown);
  const LOCAL_BATCH_SIZE = 4;

  async function runLocalBatches(): Promise<z.infer<typeof LocalSemanticResultSchema>[]> {
    const results: z.infer<typeof LocalSemanticResultSchema>[] = [];
    for (let i = 0; i < localChunks.length; i += LOCAL_BATCH_SIZE) {
      const batch = localChunks.slice(i, i + LOCAL_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((chunk) =>
          withRetries(() =>
            generateObject({
              model: localSemanticModel,
              temperature: localModelConfig.temperature,
              system: localSystem,
              messages: buildReviewMessages(chunk, contentType),
              schema: localSchema,
            }).then((r) => r.object)
          )
        )
      );
      results.push(...batchResults);
    }
    return results;
  }

  // --- Extract Task（物理规格，并行跑）---
  const extractTask = withRetries(() =>
    generateObject({
      model: extractModel,
      temperature: fr.extract.modelConfig.temperature,
      system: fr.extract.promptTemplate,
      messages: [{ role: "user", content: extractUserText }],
      schema: extractSchema,
    }).then((r) => r.object)
  );

  // Global + Local 并发启动，Extract 同时跑
  const [semSettled, extSettled] = await Promise.allSettled([
    Promise.all([globalTask, runLocalBatches()]),
    extractTask,
  ]);

  if (semSettled.status === "rejected") {
    failFormat("semantic_llm", semSettled.reason);
  }

  const [globalResult, localResults] = semSettled.value;

  // Reduce：合并 global + all local issues
  const semanticIssues: FormatSemanticIssue[] = [
    ...globalResult.issues,
    ...localResults.flatMap((r) => r.issues),
  ];

  const semanticResult = { issues: semanticIssues };

  let extractResult: z.infer<typeof formatPhysicalExtractSchema>;
  let extractLlmOk = true;
  if (extSettled.status === "fulfilled") {
    extractResult = extSettled.value;
  } else {
    extractLlmOk = false;
    extractResult = EMPTY_PHYSICAL_EXTRACT;
    console.warn(
      "[analyzeFormat] physical_extract LLM failed after retries, using empty extract:",
      extSettled.reason
    );
  }

  const semantic_llm_ms = Math.round(performance.now() - tSem0);
  const spec_extract_ms = Math.round(performance.now() - tExt0);

  let physicalIssues: PhysicalMergedIssue[] = [];
  let rules_ms = 0;
  let spec_extract_ok = extractLlmOk;
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
    semantic_model_id: fr.semantic.globalModelConfig.model,
    semantic_global_model_id: fr.semantic.globalModelConfig.model,
    semantic_local_model_id: fr.semantic.localModelConfig.model,
    extract_model_id: fr.extract.modelConfig.model,
    baseline_version: fr.engineBaseline.version,
    semantic_issue_count: semanticResult.issues.length,
    physical_issue_count: physicalIssues.length,
    compile_dropped_count,
    physical_extract: extractResult,
  };

  return { issues, observability };
}
