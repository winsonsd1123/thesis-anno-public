import type { ReviewAnalyzeContext, ReviewContentType } from "@/lib/services/review/format.service";

export type AnalyzePdfFn = (
  content: string,
  contentType: ReviewContentType,
  context: ReviewAnalyzeContext
) => Promise<unknown>;

/** 超过此体积的 PDF 不再走 base64 多模态，避免超大请求被上游/传输层中止（常见 Abort）。 */
const LARGE_PDF_MULTIMODAL_MAX_BYTES = 8 * 1024 * 1024;

function isAbortLikeError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === "AbortError") return true;
    if (/aborted/i.test(e.message)) return true;
  }
  return false;
}

/**
 * 多模态优先；失败则复用懒解析文本，避免并发降级时重复 CPU 解析。
 */
export async function executeWithFallback(
  serviceFn: AnalyzePdfFn,
  pdfBuffer: Buffer,
  getParsedText: () => Promise<string>,
  context: ReviewAnalyzeContext
): Promise<unknown> {
  if (pdfBuffer.byteLength >= LARGE_PDF_MULTIMODAL_MAX_BYTES) {
    console.info(
      `[executeWithFallback] PDF size ${pdfBuffer.byteLength} >= ${LARGE_PDF_MULTIMODAL_MAX_BYTES}, skipping multimodal (text only)`
    );
    const text = await getParsedText();
    return await serviceFn(text, "text", context);
  }

  try {
    return await serviceFn(pdfBuffer.toString("base64"), "base64", context);
  } catch (error) {
    if (isAbortLikeError(error)) {
      const msg = error instanceof Error ? error.message : String(error);
      console.info(
        `[executeWithFallback] multimodal path aborted (${msg}); using text fallback`
      );
    } else {
      console.warn("[executeWithFallback] multimodal path failed, using text fallback", error);
    }
    const text = await getParsedText();
    return await serviceFn(text, "text", context);
  }
}
