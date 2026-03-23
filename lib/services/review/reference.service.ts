import type { ReviewAnalyzeContext, ReviewContentType } from "./format.service";

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
