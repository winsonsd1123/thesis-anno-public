import type { ReviewAnalyzeContext, ReviewContentType } from "@/lib/services/review/format.service";

export type AnalyzePdfFn = (
  content: string,
  contentType: ReviewContentType,
  context: ReviewAnalyzeContext
) => Promise<unknown>;

/**
 * 多模态优先；失败则复用懒解析文本，避免并发降级时重复 CPU 解析。
 */
export async function executeWithFallback(
  serviceFn: AnalyzePdfFn,
  pdfBuffer: Buffer,
  getParsedText: () => Promise<string>,
  context: ReviewAnalyzeContext
): Promise<unknown> {
  try {
    return await serviceFn(pdfBuffer.toString("base64"), "base64", context);
  } catch (error) {
    console.warn("[executeWithFallback] multimodal path failed, using text fallback", error);
    const text = await getParsedText();
    return await serviceFn(text, "text", context);
  }
}
