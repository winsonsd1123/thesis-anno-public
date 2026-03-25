import type { ReferenceCandidate } from "@/lib/integrations/academic";

function isValidYear(y: number): boolean {
  return y >= 1900 && y <= 2100;
}

/**
 * 从参考文献行中解析「作者写在条目里的出版年」，用于与 `database_candidate.year` 硬比对。
 * 优先匹配 GB/T 常见形态：`,YYYY.DOI`、行尾 `,YYYY.`。
 */
export function extractDeclaredPublicationYear(rawText: string): number | null {
  const s = rawText.trim();
  if (!s) return null;

  let m = s.match(/,(\d{4})\s*\.\s*DOI/i);
  if (m) {
    const y = parseInt(m[1], 10);
    if (isValidYear(y)) return y;
  }

  m = s.match(/,(\d{4})\s*\.\s*$/);
  if (m) {
    const y = parseInt(m[1], 10);
    if (isValidYear(y)) return y;
  }

  const beforeDoi = s.split(/\bDOI\b/i)[0];
  const years = [...beforeDoi.matchAll(/\b(19|20)\d{2}\b/g)].map((x) => parseInt(x[0], 10));
  if (years.length === 0) return null;
  return years[years.length - 1] ?? null;
}

/** 声明年份与权威库年份是否冲突（两者皆有时才可判定）。 */
export function declaredYearMismatchCandidate(
  rawText: string,
  candidate: ReferenceCandidate | null
): { mismatch: boolean; declaredYear: number | null } {
  const cy = candidate?.year;
  if (cy == null) return { mismatch: false, declaredYear: null };
  const declared = extractDeclaredPublicationYear(rawText);
  if (declared === null) return { mismatch: false, declaredYear: null };
  return { mismatch: declared !== cy, declaredYear: declared };
}
