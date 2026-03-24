import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 与 Tech_Spec 3.4 一致：每若干页合并为一个 chunk，减少并发子任务数。 */
export const AITRACE_PAGES_PER_CHUNK = 5;

/**
 * 使用 pdfjs-dist 按页抽取纯文本（Trigger 任务内调用）。
 */
export async function extractPdfTextPerPage(pdfBuffer: Buffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerPath = join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  try {
    const n = pdf.numPages;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 1) {
      return [];
    }
    const pages: string[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const parts: string[] = [];
      for (const item of textContent.items) {
        if (item && typeof item === "object" && "str" in item && typeof item.str === "string") {
          parts.push(item.str);
        }
      }
      pages.push(parts.join(" ").replace(/\s+/g, " ").trim());
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

/**
 * 将逐页文本合并为若干带 `--- [Page X] ---` 锚点的 chunk 字符串。
 */
export function buildAiTraceChunksWithPageAnchors(
  pages: string[],
  pagesPerChunk: number = AITRACE_PAGES_PER_CHUNK
): string[] {
  if (pages.length === 0) return [];
  const chunks: string[] = [];
  for (let start = 0; start < pages.length; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, pages.length);
    const parts: string[] = [];
    for (let p = start; p < end; p++) {
      const pageNum = p + 1;
      parts.push(`--- [Page ${pageNum}] ---\n${pages[p] ?? ""}`);
    }
    chunks.push(parts.join("\n\n"));
  }
  return chunks;
}
