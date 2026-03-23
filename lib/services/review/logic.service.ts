import type { ReviewAnalyzeContext, ReviewContentType } from "./format.service";

export async function analyzeLogic(
  _content: string,
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext
): Promise<unknown> {
  return {
    stub: true,
    agent: "logic",
    contentType,
    domain: ctx.domain,
    note: "logic engine not implemented — replace per Tech_Spec_AI_Review_3_Engine",
  };
}
