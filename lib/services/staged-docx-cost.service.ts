import { storageDAL } from "@/lib/dal/storage.dal";
import { calculateReviewCost, getMaxAllowedWords } from "@/lib/config/billing";
import { countWordsFromDocxBuffer } from "@/lib/services/docx-word-count.service";
import { isValidStagingPathForUser } from "@/lib/review/staging-path";
import { DEFAULT_REVIEW_PLAN_OPTIONS } from "@/lib/review/planOptions";

export async function analyzeStagedDocxFromStorage(stagingPath: string, userId: string) {
  if (!isValidStagingPathForUser(stagingPath, userId)) {
    return { ok: false as const, error: "STAGING_INVALID" as const };
  }
  let buf: Buffer;
  try {
    buf = await storageDAL.downloadReviewPdf(stagingPath);
  } catch {
    return { ok: false as const, error: "STAGING_INVALID" as const };
  }
  let wordCount: number;
  try {
    wordCount = await countWordsFromDocxBuffer(buf);
  } catch {
    return { ok: false as const, error: "WORD_COUNT_FAILED" as const };
  }
  const maxW = await getMaxAllowedWords();
  if (wordCount > maxW) {
    return { ok: false as const, error: "WORD_COUNT_OUT_OF_RANGE" as const };
  }
  // staging 阶段尚无用户选择；用默认 planOptions 估算展示用费用
  const result = await calculateReviewCost(wordCount, DEFAULT_REVIEW_PLAN_OPTIONS);
  if (result === null) {
    return { ok: false as const, error: "COST_UNAVAILABLE" as const };
  }
  return { ok: true as const, wordCount, cost: result.totalCost };
}
