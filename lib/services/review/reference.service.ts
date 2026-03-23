import type { ReviewAnalyzeContext, ReviewContentType } from "./format.service";

/** Spec 3/3 前：占位 — 从 PDF 提取参考文献列表（多模态/文本路径由 orchestrator 的 executeWithFallback 决定） */
export async function extractReferencesFromPDF(
  _content: string,
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext
): Promise<unknown[]> {
  return [
    {
      stub: true,
      agent: "reference",
      phase: "extract",
      contentType,
      domain: ctx.domain,
      note: "replace per Tech_Spec_AI_Review_3_Engine",
    },
  ];
}

/** Spec 3/3 前：占位 — 单批核查（由 generic-llm-batch-task 调度） */
export async function verifyReferenceBatch(
  dataBatch: unknown[],
  ctx: ReviewAnalyzeContext
): Promise<unknown[]> {
  return dataBatch.map((item, i) => ({
    stub: true,
    agent: "reference",
    phase: "verify_batch",
    domain: ctx.domain,
    index: i,
    item,
    note: "replace per Tech_Spec_AI_Review_3_Engine",
  }));
}

/** 兼容旧编排：单路径占位；新编排请使用 extractReferencesFromPDF + verifyReferenceBatch */
export async function analyzeReference(
  _content: string,
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext
): Promise<unknown> {
  return {
    stub: true,
    agent: "reference",
    contentType,
    domain: ctx.domain,
    note: "reference engine not implemented — replace per Tech_Spec_AI_Review_3_Engine",
  };
}
