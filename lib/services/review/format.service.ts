export type ReviewContentType = "base64" | "text";

/** 由编排层注入；`analyzeLogic` 必填。 */
export type LogicReviewContextPayload = {
  modelConfig: { model: string; temperature: number };
  /** 已替换 {{domain}} 的 Pass1 system 全文 */
  pass1SystemPrompt: string;
  /** 仍含 {{initial_draft}}，由引擎在 Pass2 替换 */
  pass2TemplateRaw: string;
};

/** 由编排层注入；`analyzeAiTraceChunk`（经 genericLlmBatchTask）必填。 */
export type AiTraceContextPayload = {
  modelConfig: { model: string; temperature: number };
  promptTemplate: string;
};

export type ReviewAnalyzeContext = {
  domain: string | null;
  logicReview?: LogicReviewContextPayload;
  aiTrace?: AiTraceContextPayload;
};

/** Spec 3/3 前的桩：打通编排与降级链路，返回可序列化占位结构。 */
export async function analyzeFormat(
  _content: string,
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext
): Promise<unknown> {
  return {
    stub: true,
    agent: "format",
    contentType,
    domain: ctx.domain,
    note: "format engine not implemented — replace per Tech_Spec_AI_Review_3_Engine",
  };
}
