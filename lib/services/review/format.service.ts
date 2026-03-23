export type ReviewContentType = "base64" | "text";

export type ReviewAnalyzeContext = {
  domain: string | null;
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
