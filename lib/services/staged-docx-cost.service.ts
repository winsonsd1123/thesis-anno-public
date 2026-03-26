import { storageDAL } from "@/lib/dal/storage.dal";
import { estimateCostByWords, getMaxAllowedWords } from "@/lib/config/billing";
import { countWordsFromDocxBuffer } from "@/lib/services/docx-word-count.service";
import { isValidStagingPathForUser } from "@/lib/review/staging-path";

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
  const cost = await estimateCostByWords(wordCount);
  if (cost === null) {
    return { ok: false as const, error: "COST_UNAVAILABLE" as const };
  }
  return { ok: true as const, wordCount, cost };
}

