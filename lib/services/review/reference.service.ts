import { z } from "zod";
import { generateObject, zodSchema } from "ai";
import type { ModelMessage } from "ai";
import { getLLMModel } from "@/lib/integrations/openrouter";
import { searchSourcesWaterfall, type ReferenceCandidate } from "@/lib/integrations/academic";
import type { ReviewAnalyzeContext } from "./format.service";
import { buildReviewMessages } from "./review-messages";
import { ReviewEngineError } from "./review-errors";
import { declaredYearMismatchCandidate } from "./reference-citation-year";
import { findLastBibliographyHeadingLineStart } from "./reference-markdown-extract";

/** 题录提取/核查：大 payload 时避免默认过短超时导致 Abort（与 OpenRouter 长请求一致）。 */
const REFERENCE_GENERATE_OBJECT_TIMEOUT_MS = 600_000;

const REF_EXTRACT_LOG = "[reference extract]";

/**
 * 纯文本降级时整篇论文可能超出模型/上游上下文，输入被截断时常裁掉**文末**参考文献。
 * 仅保留末尾一段字符，并尽量从「参考文献」类标题起笔，提高题录召回。
 */
const REFERENCE_EXTRACT_TEXT_MAX_CHARS = 90_000;

/** LLM 兜底前：对 Hybrid 产出的 Markdown 做长度截断，尽量保留文末参考文献区块。 */
export function prepareTextForReferenceExtract(markdown: string): { text: string; clipped: boolean } {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    throw new ReviewEngineError(
      "reference extract: Markdown 正文为空，无法提取参考文献"
    );
  }
  const max = REFERENCE_EXTRACT_TEXT_MAX_CHARS;
  if (trimmed.length <= max) {
    return { text: trimmed, clipped: false };
  }
  const tail = trimmed.slice(-max);
  const hi = findLastBibliographyHeadingLineStart(tail);
  if (hi !== null && tail.length - hi >= 400) {
    const fromHeading = tail.slice(hi);
    console.info(
      `${REF_EXTRACT_LOG} LLM兜底截断: 自末次参考文献标题起 ${fromHeading.length} 字符（全文 ${trimmed.length} 字符）`
    );
    return {
      text: `【论文全文较长，以下为末尾 ${max} 字符内、自参考文献标题起的片段】\n\n${fromHeading}`,
      clipped: true,
    };
  }
  console.info(
    `${REF_EXTRACT_LOG} LLM兜底截断: 仅保留末尾 ${max} 字符（全文 ${trimmed.length} 字符）`
  );
  return {
    text: `【论文全文较长，以下为末尾 ${max} 字符；参考文献通常在文末】\n\n${tail}`,
    clipped: true,
  };
}

const referenceItemSchema = z.object({
  id: z.number().int().min(1),
  title: z.string(),
  rawText: z.string(),
  authors: z.array(z.string()).optional(),
});

export type ReferenceListItem = z.infer<typeof referenceItemSchema>;

const referenceExtractSchema = z.object({
  references: z.array(referenceItemSchema),
});

export type ReferenceExtractResult = z.infer<typeof referenceExtractSchema>;

/** 每项字段均必填：Azure / OpenAI strict JSON schema 要求 properties 与 required 一致，不可用 optional 字段。 */
const batchVerificationRowSchema = z.object({
  id: z.number(),
  fact_status: z.enum(["real", "fake_or_not_found", "suspected"]),
  format_status: z.enum(["standard", "unstandard"]),
  reason: z.string(),
  /** 无修正时填空字符串（勿省略该键） */
  standard_format: z.string(),
});

const batchVerificationSchema = z.object({
  results: z.array(batchVerificationRowSchema),
});

export type ReferenceVerificationRow = ReferenceListItem & {
  fact_status: "real" | "fake_or_not_found" | "suspected";
  format_status: "standard" | "unstandard";
  reason: string;
  standard_format?: string;
  database_candidate: ReferenceCandidate | null;
};

function parseRefBatch(dataBatch: unknown[]): ReferenceListItem[] {
  const parsed = z.array(referenceItemSchema).safeParse(dataBatch);
  if (!parsed.success) {
    throw new ReviewEngineError(
      `verifyReferenceBatch: invalid batch shape: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

/** 题录是否以中文为主（用于中英双轨真实性策略：中文可在 API 未命中时用世界知识兜底）。 */
export function languagePrimaryForReference(title: string, rawText: string): "zh" | "en" {
  const sample = `${title}\n${rawText.slice(0, 400)}`;
  return /[\u4e00-\u9fff]/.test(sample) ? "zh" : "en";
}

/**
 * 提取后先按 `languagePrimaryForReference` 分流再分批，使每批语言一致，
 * 单次 `verifyReferenceBatch` 内只走一条 LLM 路径，便于跑满 `verify_batch_size`。
 * 顺序：英文队列批次在前，中文批次在后（最终须按 id 还原参考文献序）。
 */
export function chunkReferenceListByLanguageForVerify(
  refs: ReferenceListItem[],
  batchSize: number
): ReferenceListItem[][] {
  const size = batchSize > 0 ? batchSize : 10;
  const en: ReferenceListItem[] = [];
  const zh: ReferenceListItem[] = [];
  for (const ref of refs) {
    if (languagePrimaryForReference(ref.title, ref.rawText) === "zh") {
      zh.push(ref);
    } else {
      en.push(ref);
    }
  }
  const chunk = (arr: ReferenceListItem[]): ReferenceListItem[][] => {
    const out: ReferenceListItem[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  };
  return [...chunk(en), ...chunk(zh)];
}

function buildBatchVerificationMessages(
  items: Array<{
    id: number;
    title: string;
    rawText: string;
    candidate: ReferenceCandidate | null;
  }>
): ModelMessage[] {
  const payload = {
    items: items.map(({ id, title, rawText, candidate }) => ({
      id,
      raw_reference_text: rawText,
      database_candidate: candidate,
      language_primary: languagePrimaryForReference(title, rawText),
    })),
  };
  return [
    {
      role: "user",
      content: `以下为待核查文献批次（JSON）。请按系统指令输出 results，覆盖每个 id。\n\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

function fail(phase: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new ReviewEngineError(`reference ${phase} failed: ${msg}`, e);
}

/**
 * 从 Hybrid 解析得到的 Markdown 提取文末参考文献列表（结构化）。
 * 优先纯代码切片分条；无标题或 0 条时用 `reference_extract`（Flash 等）对同一段 Markdown（可截断）做 LLM 结构化提取。
 */
export async function extractReferences(
  markdown: string,
  ctx: ReviewAnalyzeContext
): Promise<ReferenceListItem[]> {
  const rx = ctx.referenceExtract;
  if (!rx) {
    throw new ReviewEngineError(
      "reference extract: missing referenceExtract on context (orchestrator must inject prompts and model_config)"
    );
  }

  // 无参考文献章节标题 → 论文没有参考文献清单，直接跳过，避免误把正文行文引用当作参考文献
  const hasHeading = findLastBibliographyHeadingLineStart(markdown) !== null;
  if (!hasHeading) {
    console.info(
      `${REF_EXTRACT_LOG} 来源=跳过 原因=论文无参考文献章节标题`
    );
    return [];
  }

  // 有标题则交给 LLM 提取（格式多样，LLM 比代码正则更可靠）
  console.info(
    `${REF_EXTRACT_LOG} 来源=LLM 将调用 reference_extract model=${rx.modelConfig.model}`
  );

  const model = getLLMModel(rx.modelConfig.model);
  const prepared = prepareTextForReferenceExtract(markdown);
  console.info(
    `${REF_EXTRACT_LOG} 来源=LLM兜底 输入 text_clipped=${prepared.clipped} 输入长度=${prepared.text.length}`
  );
  const messages = buildReviewMessages(prepared.text, "text");
  const schema = zodSchema(referenceExtractSchema);

  try {
    const { object } = await generateObject({
      model,
      temperature: rx.modelConfig.temperature,
      system: rx.promptTemplate,
      messages,
      schema,
      abortSignal: AbortSignal.timeout(REFERENCE_GENERATE_OBJECT_TIMEOUT_MS),
    });
    const refs = object.references;
    console.info(
      `${REF_EXTRACT_LOG} 来源=LLM兜底 完成 条数=${refs.length} model=${rx.modelConfig.model}`
    );
    return refs;
  } catch (e) {
    fail("extract", e);
  }
}

/**
 * 批量核查：先多源 API 检索，再单次 LLM 裁判。
 */
export async function verifyReferenceBatch(
  dataBatch: unknown[],
  ctx: ReviewAnalyzeContext
): Promise<ReferenceVerificationRow[]> {
  const rv = ctx.referenceVerify;
  if (!rv) {
    throw new ReviewEngineError(
      "reference verify: missing referenceVerify on context (orchestrator must inject prompts and model_config)"
    );
  }

  const refsBatch = parseRefBatch(dataBatch);
  if (refsBatch.length === 0) return [];

  let candidates: Array<{
    id: number;
    title: string;
    rawText: string;
    candidate: ReferenceCandidate | null;
  }>;
  try {
    candidates = await Promise.all(
      refsBatch.map(async (ref) => {
        const candidate = await searchSourcesWaterfall({
          title: ref.title,
          rawText: ref.rawText,
        });
        return {
          id: ref.id,
          title: ref.title,
          rawText: ref.rawText,
          candidate,
        };
      })
    );
  } catch (e) {
    fail("metadata_search", e);
  }

  const schema = zodSchema(batchVerificationSchema);
  const enSubset = candidates.filter(
    (c) => languagePrimaryForReference(c.title, c.rawText) === "en"
  );
  const zhSubset = candidates.filter(
    (c) => languagePrimaryForReference(c.title, c.rawText) === "zh"
  );
  const zhModelId = rv.modelConfig.model_zh?.trim() || rv.modelConfig.model;
  const enModelId = rv.modelConfig.model;
  const verifyTemperature = rv.modelConfig.temperature;
  const verifySystemPrompt = rv.promptTemplate;

  async function runLlmVerify(
    subset: typeof candidates
  ): Promise<z.infer<typeof batchVerificationSchema>> {
    if (subset.length === 0) {
      return { results: [] };
    }
    const isZh = languagePrimaryForReference(subset[0].title, subset[0].rawText) === "zh";
    const modelId = isZh ? zhModelId : enModelId;
    const model = getLLMModel(modelId);
    const messages = buildBatchVerificationMessages(subset);
    const gen = await generateObject({
      model,
      temperature: verifyTemperature,
      system: verifySystemPrompt,
      messages,
      schema,
      abortSignal: AbortSignal.timeout(REFERENCE_GENERATE_OBJECT_TIMEOUT_MS),
    });
    return gen.object;
  }

  let verification: z.infer<typeof batchVerificationSchema>;
  try {
    if (enSubset.length > 0 && zhSubset.length > 0) {
      const [enVer, zhVer] = await Promise.all([
        runLlmVerify(enSubset),
        runLlmVerify(zhSubset),
      ]);
      verification = {
        results: [...enVer.results, ...zhVer.results],
      };
    } else if (enSubset.length > 0) {
      verification = await runLlmVerify(enSubset);
    } else {
      verification = await runLlmVerify(zhSubset);
    }
  } catch (e) {
    fail("llm_verify", e);
  }

  const byId = new Map(verification.results.map((r) => [r.id, r]));
  const out: ReferenceVerificationRow[] = [];

  for (const ref of refsBatch) {
    const v = byId.get(ref.id);
    if (!v) {
      throw new ReviewEngineError(
        `reference verify: LLM result missing id ${ref.id} in results`
      );
    }
    const cand = candidates.find((c) => c.id === ref.id)?.candidate ?? null;
    let factStatus = v.fact_status;
    let formatStatus = v.format_status;
    let reason = v.reason;
    let standardFormat =
      v.standard_format.trim() === "" ? undefined : v.standard_format.trim();

    const yearCheck = declaredYearMismatchCandidate(ref.rawText, cand);
    if (yearCheck.mismatch && cand?.year != null) {
      factStatus = "fake_or_not_found";
      formatStatus = "unstandard";
      const hint = `年份与权威记录不符（条目${yearCheck.declaredYear}，库${cand.year}）`;
      reason = reason?.trim() ? `${reason}；${hint}` : hint;
      if (standardFormat === undefined || standardFormat === "") {
        standardFormat = `[请按库中年份 ${cand.year} 等字段核对后重写本条]`;
      }
    }

    out.push({
      ...ref,
      fact_status: factStatus,
      format_status: formatStatus,
      reason,
      ...(standardFormat !== undefined && standardFormat !== ""
        ? { standard_format: standardFormat }
        : {}),
      database_candidate: cand,
    });
  }

  return out;
}

export function sortReferenceVerificationRowsById(
  rows: ReferenceVerificationRow[]
): ReferenceVerificationRow[] {
  return [...rows].sort((a, b) => a.id - b.id);
}

/**
 * 兼容旧编排：提取后按语言分流再按批大小核查并拍平（与 `reference_verification.verify_batch_size` / `ctx.referenceVerify.batchSize` 一致）。
 */
export async function analyzeReference(
  markdown: string,
  ctx: ReviewAnalyzeContext
): Promise<ReferenceVerificationRow[]> {
  const refs = await extractReferences(markdown, ctx);
  if (refs.length === 0) return [];

  const batchSize = ctx.referenceVerify?.batchSize ?? 10;
  const chunks = chunkReferenceListByLanguageForVerify(refs, batchSize);

  const batches = await Promise.all(chunks.map((batch) => verifyReferenceBatch(batch, ctx)));
  return sortReferenceVerificationRowsById(batches.flat());
}
