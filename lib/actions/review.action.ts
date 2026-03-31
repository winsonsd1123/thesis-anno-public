"use server";

import { createClient } from "@/lib/supabase/server";
import { isAllowedDocx, DOCX_MIME } from "@/lib/browser/thesis-file";
import { isValidStagingPathForUser } from "@/lib/review/staging-path";
import { storageDAL } from "@/lib/dal/storage.dal";
import { reviewService } from "@/lib/services/review.service";
import { supportTicketService } from "@/lib/services/support-ticket.service";
import type { ReviewRow } from "@/lib/types/review";
import { countWordsFromDocxBuffer } from "@/lib/services/docx-word-count.service";
import { analyzeStagedDocxFromStorage } from "@/lib/services/staged-docx-cost.service";
import { calculateReviewCost, getMaxAllowedWords } from "@/lib/config/billing";
import { DEFAULT_REVIEW_PLAN_OPTIONS, normalizePlanOptions } from "@/lib/review/planOptions";
import { loadDefaultFormatGuidelinesZhFromDisk } from "@/lib/services/review/format-review-config";

const MAX_THESIS_BYTES = 50 * 1024 * 1024;

/** 单次提交：内存中计字 → 上传正式路径 → 落库（无 staging 交互） */
export type CreateReviewFromDocxResult =
  | { ok: true; reviewId: number; fileName: string; domain: string; wordCount: number; cost: number }
  | { ok: false; error: string };

export async function createReviewFromDocxUpload(formData: FormData): Promise<CreateReviewFromDocxResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const file = formData.get("file");
  const domainRaw = formData.get("domain");
  if (!(file instanceof File)) {
    return { ok: false, error: "FILE_REQUIRED" };
  }
  const domain = typeof domainRaw === "string" ? domainRaw.trim() : "";

  if (file.size > MAX_THESIS_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (!isAllowedDocx(file)) {
    return { ok: false, error: "FILE_NOT_DOCX" };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  let wordCount: number;
  try {
    wordCount = await countWordsFromDocxBuffer(buf);
  } catch (e) {
    console.error("[createReviewFromDocxUpload] count", e);
    return { ok: false, error: "WORD_COUNT_FAILED" };
  }

  const maxW = await getMaxAllowedWords();
  if (wordCount > maxW) {
    return { ok: false, error: "WORD_COUNT_OUT_OF_RANGE" };
  }

  const costResult = await calculateReviewCost(wordCount, DEFAULT_REVIEW_PLAN_OPTIONS);
  if (costResult === null) {
    return { ok: false, error: "COST_UNAVAILABLE" };
  }
  const cost = costResult.totalCost;

  let finalPath: string;
  try {
    finalPath = await storageDAL.uploadReviewFile(auth.user.id, file.name, buf, DOCX_MIME);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createReviewFromDocxUpload] upload", msg);
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  try {
    const reviewId = await reviewService.insertReview({
      userId: auth.user.id,
      fileUrl: finalPath,
      fileName: file.name,
      domain,
      wordCount,
    });
    return { ok: true, reviewId, fileName: file.name, domain, wordCount, cost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createReviewFromDocxUpload] insert", msg);
    try {
      await storageDAL.removeObject(finalPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}

export type StageDocxUploadResult =
  | { ok: true; stagingPath: string; wordCount: number; cost: number; fileName: string }
  | { ok: false; error: string };

/**
 * 同请求内先解析字数再上传 staging，避免「先上传再下载」做第一次统计。
 */
export async function stageDocxUploadAndAnalyzeCost(formData: FormData): Promise<StageDocxUploadResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "FILE_REQUIRED" };
  }

  if (file.size > MAX_THESIS_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (!isAllowedDocx(file)) {
    return { ok: false, error: "FILE_NOT_DOCX" };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  let wordCount: number;
  try {
    wordCount = await countWordsFromDocxBuffer(buf);
  } catch (e) {
    console.error("[stageDocxUploadAndAnalyzeCost] count", e);
    return { ok: false, error: "WORD_COUNT_FAILED" };
  }

  const maxW = await getMaxAllowedWords();
  if (wordCount > maxW) {
    return { ok: false, error: "WORD_COUNT_OUT_OF_RANGE" };
  }

  const stageCostResult = await calculateReviewCost(wordCount, DEFAULT_REVIEW_PLAN_OPTIONS);
  if (stageCostResult === null) {
    return { ok: false, error: "COST_UNAVAILABLE" };
  }

  try {
    const stagingPath = await storageDAL.uploadStagingDocx(auth.user.id, buf);
    return { ok: true, stagingPath, wordCount, cost: stageCostResult.totalCost, fileName: file.name };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stageDocxUploadAndAnalyzeCost] storage", msg);
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}

export type FinalizeReviewFromStagingResult =
  | { ok: true; reviewId: number; fileName: string; domain: string; wordCount: number; cost: number }
  | { ok: false; error: string };

export async function finalizeReviewFromStaging(input: {
  stagingPath: string;
  domain: string;
  fileName: string;
}): Promise<FinalizeReviewFromStagingResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const domain = typeof input.domain === "string" ? input.domain.trim() : "";
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const { stagingPath } = input;

  if (!fileName) {
    return { ok: false, error: "FILE_REQUIRED" };
  }

  if (!isValidStagingPathForUser(stagingPath, auth.user.id)) {
    return { ok: false, error: "STAGING_INVALID" };
  }

  const analyzed = await analyzeStagedDocxFromStorage(stagingPath, auth.user.id);
  if (!analyzed.ok) {
    return { ok: false, error: analyzed.error };
  }
  const { wordCount, cost } = analyzed;

  let finalPath: string;
  try {
    finalPath = await storageDAL.promoteStagingToFinal(stagingPath, auth.user.id, fileName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[finalizeReviewFromStaging] promote", msg);
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  try {
    const reviewId = await reviewService.insertReview({
      userId: auth.user.id,
      fileUrl: finalPath,
      fileName,
      domain,
      wordCount,
    });
    return { ok: true, reviewId, fileName, domain, wordCount, cost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[finalizeReviewFromStaging] insert", msg);
    try {
      await storageDAL.removeObject(finalPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}

export type SimpleActionResult = { ok: true } | { ok: false; error: string };

export async function updateReviewDomain(reviewId: number, domain: string): Promise<SimpleActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };
  const d = typeof domain === "string" ? domain.trim() : "";

  try {
    await reviewService.updateDomain(reviewId, auth.user.id, d);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "REVIEW_NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    console.error("[updateReviewDomain]", msg);
    return { ok: false, error: "DOMAIN_UPDATE_FAILED" };
  }
}

export async function renameReview(reviewId: number, name: string): Promise<SimpleActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "FILE_REQUIRED" };
  try {
    await reviewService.renameReview(reviewId, auth.user.id, trimmed);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "REVIEW_NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    console.error("[renameReview]", msg);
    return { ok: false, error: "GENERIC" };
  }
}

export async function deleteReview(reviewId: number): Promise<SimpleActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };
  try {
    const blocked = await supportTicketService.reviewHasBlockingTicket(supabase, reviewId, auth.user.id);
    if (blocked) return { ok: false, error: "OPEN_SUPPORT_TICKET" };
    const fileUrl = await reviewService.deleteReview(reviewId, auth.user.id);
    if (fileUrl) {
      try {
        await storageDAL.removeObject(fileUrl);
      } catch (e) {
        console.warn("[deleteReview] storage cleanup", e);
      }
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "REVIEW_NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    console.error("[deleteReview]", msg);
    return { ok: false, error: "GENERIC" };
  }
}

export type ReplaceReviewPdfResult = { ok: true; fileName: string } | { ok: false; error: string };

export async function replaceReviewPdf(reviewId: number, formData: FormData): Promise<ReplaceReviewPdfResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "FILE_REQUIRED" };
  }

  if (file.size > MAX_THESIS_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (!isAllowedDocx(file)) {
    return { ok: false, error: "FILE_NOT_DOCX" };
  }

  let existing: ReviewRow;
  try {
    const row = await reviewService.getReviewForUser(reviewId, auth.user.id);
    if (!row) return { ok: false, error: "NOT_FOUND" };
    if (row.status !== "pending") return { ok: false, error: "INVALID_STATUS" };
    existing = row;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[replaceReviewPdf] get", msg);
    return { ok: false, error: "NOT_FOUND" };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  let wordCount: number;
  try {
    wordCount = await countWordsFromDocxBuffer(buf);
  } catch (e) {
    console.error("[replaceReviewPdf] count", e);
    return { ok: false, error: "WORD_COUNT_FAILED" };
  }

  const maxW = await getMaxAllowedWords();
  if (wordCount > maxW) {
    return { ok: false, error: "WORD_COUNT_OUT_OF_RANGE" };
  }

  const replacePlan = normalizePlanOptions(existing.plan_options);
  const costCheck = await calculateReviewCost(wordCount, replacePlan);
  if (costCheck === null) {
    return { ok: false, error: "COST_UNAVAILABLE" };
  }

  const oldPath = existing.file_url;

  try {
    const path = await storageDAL.uploadReviewFile(auth.user.id, file.name, buf, DOCX_MIME);
    await reviewService.updateReviewFile(reviewId, auth.user.id, {
      fileUrl: path,
      fileName: file.name,
      wordCount,
    });
    try {
      if (oldPath && oldPath !== path) {
        await storageDAL.removeObject(oldPath);
      }
    } catch (e) {
      console.warn("[replaceReviewPdf] remove old object", e);
    }
    return { ok: true, fileName: file.name };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[replaceReviewPdf]", msg);
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}

export type UpdateFormatGuidelinesResult = { ok: true } | { ok: false; error: string };

export async function updateReviewFormatGuidelines(
  reviewId: number,
  formatGuidelines: string
): Promise<UpdateFormatGuidelinesResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };
  try {
    await reviewService.updateFormatGuidelines(reviewId, auth.user.id, formatGuidelines);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("REVIEW_NOT_FOUND")) return { ok: false, error: "NOT_FOUND" };
    console.error("[updateReviewFormatGuidelines]", msg);
    return { ok: false, error: "GENERIC" };
  }
}

export type DefaultFormatGuidelinesResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** 供「导入通用模板」：读取本地默认 NL（管理员可替换 config 文件） */
export async function getDefaultFormatGuidelinesZh(): Promise<DefaultFormatGuidelinesResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };
  try {
    const text = loadDefaultFormatGuidelinesZhFromDisk();
    return { ok: true, text };
  } catch (e) {
    console.error("[getDefaultFormatGuidelinesZh]", e);
    return { ok: false, error: "GENERIC" };
  }
}
