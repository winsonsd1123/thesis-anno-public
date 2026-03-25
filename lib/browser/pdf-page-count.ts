/**
 * 浏览器内用 PDF.js 读取页数，避免在 Serverless 上对整份 PDF 做 pdf-parse 导致内存峰值过高。
 * 仅允许在 Client Component 中调用。
 *
 * Worker 版本须与 package.json 中的 pdfjs-dist 保持一致。
 */
const PDFJS_DIST_VERSION = "4.10.38";

export async function getPdfPageCountFromFile(file: File): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const n = pdf.numPages;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 1) {
      throw new Error("INVALID_NUM_PAGES");
    }
    return n;
  } finally {
    await pdf.destroy();
  }
}
