/** 检索查询用：折叠空白 */
export function normTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

/**
 * 网页/网址类参考文献：不做 CrossRef 等学术库检索（仍保留上方 DOI/PMID 精确路径）。
 * 若原文含 DOI（含 https://doi.org/10.x…）或 PMID，返回 false，继续走标识符检索。
 */
export function isUrlReferenceWithoutScholarIdentifiers(rawText: string, title: string): boolean {
  const raw = rawText.trim();
  const t = title.trim();
  if (/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(rawText)) return false;
  if (/PMID[:\s]*\d+/i.test(rawText)) return false;

  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true;
  if (/^https?:\/\//i.test(raw) || /^www\./i.test(raw)) return true;

  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";
  if (
    firstLine.length > 0 &&
    /^https?:\/\/\S+$/i.test(firstLine) &&
    !/10\.\d{4,9}\//i.test(firstLine)
  ) {
    return true;
  }

  return false;
}

/** 参考文献条目标题是否以中文等 CJK 为主：标题瀑布仅跑 CrossRef→OpenAlex（见 waterfall） */
export function isPrimarilyCjkTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  const cjk = (t.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length;
  if (cjk >= 2 && latin <= 2) return true;
  if (cjk >= 3 && cjk > latin * 2) return true;
  return false;
}

/**
 * 题名归一化后用于「是否同一条」的严格相等（无相似度阈值：要么一致，要么不算命中）。
 */
export function normalizeTitleForExactMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesExactMatchNormalized(expectedTitle: string, candidateTitle: string | null): boolean {
  if (!candidateTitle?.trim()) return false;
  return normalizeTitleForExactMatch(expectedTitle) === normalizeTitleForExactMatch(candidateTitle);
}
