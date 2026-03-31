import { z } from "zod";
import { generateObject, generateText, zodSchema, type LanguageModelUsage } from "ai";
import { getLLMModel } from "@/lib/integrations/openrouter";
import type { DocxStyleAstNode, DocumentSetup } from "@/lib/types/docx-hybrid";
import {
  formatPhysicalExtractSchema,
  type FormatPhysicalExtract,
} from "@/lib/schemas/format-physical-extract.schema";
import type { FormatEngineBaseline } from "@/lib/schemas/format-engine-baseline.schema";
import { compilePhysicalRules } from "@/lib/review/compile-physical-rules";
import { runPhysicalRuleEngine } from "@/lib/services/review/format-rules.engine";
import {
  runStructuralChecks,
  DEFAULT_DOCUMENT_TYPE,
  type DocumentType,
} from "@/lib/review/structural-rules";
import { buildReviewMessages } from "./review-messages";
import { ReviewEngineError } from "./review-errors";
import {
  extractGlobalSkeleton,
  splitMarkdownByChapters,
} from "@/lib/review/format-markdown-chunks";
import { stripDocxImagePlaceholders } from "@/lib/review/hybrid-docx-parser";

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
  /** 审阅发起时的界面语言（参考文献核查补充指令等）；缺省按 zh */
  reviewUiLocale?: "zh" | "en";
  /** 文档类型，用于门控结构完整性规则；未传时默认 chinese_degree_thesis */
  documentType?: DocumentType;
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

/** 单块 Local Pass 语义结果（供 Trigger 子任务序列化/反序列化）*/
export type FormatLocalSemanticResult = z.infer<typeof LocalSemanticResultSchema>;

/** 编排层注入的 Local 执行器接口；Trigger 实现时走 batchTriggerAndWait，测试/回退时走进程内批量 */
export type RunFormatLocalChunksFn = (chunks: string[]) => Promise<FormatLocalSemanticResult[]>;

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

/** 与 OPENROUTER_LOG_PROMPTS=1 配套：单行性能/token 摘要（便于对照 logs/openrouter 下完整往返） */
function formatReviewPerfLogEnabled(): boolean {
  return process.env.OPENROUTER_LOG_PROMPTS?.trim() === "1";
}

function usageSnapshot(u: LanguageModelUsage | undefined): Record<string, unknown> | null {
  if (!u) return null;
  return {
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    totalTokens: u.totalTokens,
    textTokens: u.outputTokenDetails?.textTokens,
    reasoningTokens: u.outputTokenDetails?.reasoningTokens ?? u.reasoningTokens,
    raw: u.raw,
  };
}

function mergeUsages(us: LanguageModelUsage[]): LanguageModelUsage | undefined {
  if (us.length === 0) return undefined;
  let input = 0;
  let output = 0;
  let total = 0;
  let reasoning = 0;
  let text = 0;
  for (const u of us) {
    if (u.inputTokens != null) input += u.inputTokens;
    if (u.outputTokens != null) output += u.outputTokens;
    if (u.totalTokens != null) total += u.totalTokens;
    const r = u.outputTokenDetails?.reasoningTokens ?? u.reasoningTokens;
    if (r != null) reasoning += r;
    const t = u.outputTokenDetails?.textTokens;
    if (t != null) text += t;
  }
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: {
      textTokens: text || undefined,
      reasoningTokens: reasoning || undefined,
    },
  };
}

async function writeFormatDebugFile(filename: string, content: string): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "logs", "format");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${filename}`);
    await fs.writeFile(file, content, "utf8");
  } catch (e) {
    console.warn("[analyzeFormat] failed to write format debug file:", e);
  }
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
 * 单块 Local 语义审查，供 Trigger genericLlmBatchTask（action: format_local_chunk）调用。
 * 带 withRetries（3 次），与进程内 runLocalBatches 容错能力一致。
 */
export async function analyzeFormatLocalChunk(
  chunk: string,
  fr: FormatReviewContextPayload,
  contentType: ReviewContentType = "text",
): Promise<FormatLocalSemanticResult> {
  const model = getLLMModel(fr.semantic.localModelConfig.model);
  const system = fr.semantic.localPromptTemplate.replace(
    "{{format_guidelines}}",
    fr.formatGuidelines,
  );
  const schema = zodSchema(LocalSemanticResultSchema);
  const gen = await withRetries(() =>
    generateObject({
      model,
      temperature: fr.semantic.localModelConfig.temperature,
      system,
      messages: buildReviewMessages(chunk, contentType),
      schema,
    })
  );
  return gen.object;
}

/**
 * 双轨：语义轨（高级模型 + Markdown）与 NL→Extract→compile→物理规则引擎（styleAst）。
 */
export async function analyzeFormat(
  markdown: string,
  styleAst: DocxStyleAstNode[],
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext,
  documentSetup?: DocumentSetup,
  headerFooterAst?: DocxStyleAstNode[],
  runLocalChunksFn?: RunFormatLocalChunksFn,
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
  const extractUserText = `以下为用户提供的论文格式要求（自然语言）。请仅依据文中**明确写出**的约束抽取结构化字段；禁止臆造未出现的规则。\n\n---\n${fr.formatGuidelines}`;

  const tSem0 = performance.now();
  const tExt0 = performance.now();

  // 格式审查 LLM 看不到图片，图片占位符（`![图N]()`）插入句子中间只会造成误报，预先剥离
  const cleanMarkdown = stripDocxImagePlaceholders(markdown);

  // --- 构建 Global Task ---
  const globalSkeleton = extractGlobalSkeleton(cleanMarkdown);
  const globalTask = withRetries(() =>
    generateObject({
      model: globalSemanticModel,
      temperature: globalModelConfig.temperature,
      system: globalSystem,
      messages: [{ role: "user", content: globalSkeleton }],
      schema: globalSchema,
    })
  );

  // --- 构建 Local Tasks ---
  const localChunks = splitMarkdownByChapters(cleanMarkdown);
  // 进程内回退并发数（runLocalChunksFn 未注入时使用）；正常由 Trigger batchTriggerAndWait 控制并发
  const LOCAL_BATCH_SIZE = 2;

  type LocalSemanticRun = {
    results: FormatLocalSemanticResult[];
    usages: LanguageModelUsage[];
  };

  async function runLocalBatches(): Promise<LocalSemanticRun> {
    const results: FormatLocalSemanticResult[] = [];
    const usages: LanguageModelUsage[] = [];
    for (let i = 0; i < localChunks.length; i += LOCAL_BATCH_SIZE) {
      const batch = localChunks.slice(i, i + LOCAL_BATCH_SIZE);
      const batchGen = await Promise.all(
        batch.map((chunk) =>
          withRetries(() =>
            generateObject({
              model: localSemanticModel,
              temperature: localModelConfig.temperature,
              system: localSystem,
              messages: buildReviewMessages(chunk, contentType),
              schema: localSchema,
            })
          )
        )
      );
      for (const g of batchGen) {
        results.push(g.object);
        usages.push(g.usage);
      }
    }
    return { results, usages };
  }

  async function runLocalSemanticParallel(): Promise<
    [Awaited<typeof globalTask>, LocalSemanticRun]
  > {
    const localPart: Promise<LocalSemanticRun> = runLocalChunksFn
      ? runLocalChunksFn(localChunks).then((results) => ({ results, usages: [] }))
      : runLocalBatches();
    return Promise.all([globalTask, localPart]);
  }

  // --- Extract Task（物理规格，并行跑）---
  // 使用 generateText 而非 generateObject：Gemini structured output 对 optional array-item
  // 字段极度保守（只填 required），导致 headings 只返回 level。改为自由文本 + Zod 手动解析。
  const extractTask = withRetries(() =>
    generateText({
      model: extractModel,
      temperature: fr.extract.modelConfig.temperature,
      system: fr.extract.promptTemplate + "\n\n请以严格 JSON 格式输出，不要包含 markdown 代码块标记。",
      messages: [{ role: "user", content: extractUserText }],
    }).then((gen) => {
      const jsonStr = gen.text
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const object = formatPhysicalExtractSchema.parse(JSON.parse(jsonStr));
      return { object, usage: gen.usage, reasoning: gen.reasoning };
    })
  );

  // Global + Local 并发启动，Extract 同时跑；Local 优先走注入的 runLocalChunksFn（Trigger 子任务），
  // 未注入时回退为进程内进程 runLocalBatches（LOCAL_BATCH_SIZE = 2）
  const [semSettled, extSettled] = await Promise.allSettled([
    runLocalSemanticParallel(),
    extractTask,
  ]);

  if (semSettled.status === "rejected") {
    failFormat("semantic_llm", semSettled.reason);
  }

  const [globalGen, localRun] = semSettled.value;
  const globalResult = globalGen.object;
  const localResults = localRun.results;
  const localUsageMerged = mergeUsages(localRun.usages);

  // Reduce：合并 global + all local issues
  const semanticIssues: FormatSemanticIssue[] = [
    ...globalResult.issues,
    ...localResults.flatMap((r) => r.issues),
  ];

  const semanticResult = { issues: semanticIssues };

  let extractResult: FormatPhysicalExtract;
  let extractLlmOk = true;
  let extractGen: Awaited<typeof extractTask> | null = null;
  if (extSettled.status === "fulfilled") {
    extractGen = extSettled.value;
    extractResult = extractGen.object;
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
    const body = JSON.stringify(extractResult, null, 2);
    await writeFormatDebugFile("physical-extract.json", body);
  }

  const hasGlobalRules = !!(
    program.global_rules?.page_setup ||
    program.global_rules?.header ||
    program.global_rules?.footer ||
    program.global_rules?.page_number
  );
  try {
    if (program.rules.length > 0 || hasGlobalRules) {
      physicalIssues = runPhysicalRuleEngine(
        styleAst,
        program,
        fr.engineBaseline,
        documentSetup,
        headerFooterAst,
      ) as PhysicalMergedIssue[];
    }
  } catch (e) {
    spec_extract_ok = false;
    console.warn("[analyzeFormat] physical rules skipped:", e);
  }

  // 结构完整性检查（确定性，不依赖 LLM，按文档类型门控）
  const structuralIssues = runStructuralChecks(
    { styleAst, markdown },
    ctx.documentType ?? DEFAULT_DOCUMENT_TYPE,
  );
  physicalIssues = [...physicalIssues, ...structuralIssues as PhysicalMergedIssue[]];

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

  if (formatReviewPerfLogEnabled()) {
    const note = runLocalChunksFn
      ? "local_semantic usage 在子任务进程；查各 worker 的 logs/openrouter"
      : undefined;
    console.info(
      "[analyzeFormat] perf %s",
      JSON.stringify({
        ms: { semantic_llm_ms, spec_extract_ms, rules_ms },
        chunks: localChunks.length,
        local_inline: !runLocalChunksFn,
        usage: {
          global: usageSnapshot(globalGen.usage),
          extract: extractGen ? usageSnapshot(extractGen.usage) : null,
          local_merged: localUsageMerged ? usageSnapshot(localUsageMerged) : null,
        },
        reasoning_chars: {
          global: globalGen.reasoning?.length ?? 0,
          extract: extractGen?.reasoning?.length ?? 0,
        },
        note,
      })
    );
  }

  return { issues, observability };
}
