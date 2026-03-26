import { z } from "zod";
import { generateObject, zodSchema } from "ai";
import { getLLMModel } from "@/lib/integrations/openrouter";
import type { AiTraceContextPayload } from "./format.service";
import { ReviewEngineError } from "./review-errors";

const aiTraceIssueSchema = z.object({
  chapter: z.string(),
  /** 与输入中 `--- [章节名 - 第 N 段] ---` 方括号内全文一致，便于定位 */
  location_anchor: z.string(),
  quote_text: z.string(),
  issue_type: z.enum([
    "cliche_vocabulary",
    "robotic_structure",
    "over_symmetrical",
  ]),
  severity: z.enum(["High", "Medium", "Low"]),
  analysis: z.string(),
  suggestion: z.string(),
});

export type AiTraceIssue = z.infer<typeof aiTraceIssueSchema>;

const SEVERITY_ORDER: Record<AiTraceIssue["severity"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/** 合并后阅读顺序：先按段落锚点（文档顺序近似），再按严重程度 High→Low。 */
export function sortAiTraceIssues(issues: AiTraceIssue[]): AiTraceIssue[] {
  return [...issues].sort((a, b) => {
    const byLoc = a.location_anchor.localeCompare(b.location_anchor, "zh-CN");
    if (byLoc !== 0) return byLoc;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
}

export const AiTraceResultSchema = z.object({
  issues: z.array(aiTraceIssueSchema),
});

export type AiTraceLlmObject = z.infer<typeof AiTraceResultSchema>;

export type AiTraceReviewResult = AiTraceLlmObject;

/** 聚合各 chunk 子任务输出，丢弃无法解析的条目。 */
export function mergeAiTraceChunkOutputs(outputs: unknown[]): AiTraceReviewResult {
  const issues: AiTraceIssue[] = [];
  for (const out of outputs) {
    const parsed = AiTraceResultSchema.safeParse(out);
    if (parsed.success) {
      issues.push(...parsed.data.issues);
    }
  }
  return { issues: sortAiTraceIssues(issues) };
}

function failChunk(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new ReviewEngineError(`ai trace chunk failed: ${msg}`, e);
}

/**
 * 单块无状态审查；由 Trigger `genericLlmBatchTask`（action: aitrace_chunk）并发调用。
 */
export async function analyzeAiTraceChunk(
  chunkContent: string,
  ctx: AiTraceContextPayload
): Promise<AiTraceReviewResult> {
  const model = getLLMModel(ctx.modelConfig.model);
  const temperature = Math.min(ctx.modelConfig.temperature, 0.3);
  const schema = zodSchema(AiTraceResultSchema);

  try {
    const { object } = await generateObject({
      model,
      temperature,
      system: ctx.promptTemplate,
      messages: [{ role: "user", content: chunkContent }],
      schema,
    });
    return object;
  } catch (e) {
    failChunk(e);
  }
}
