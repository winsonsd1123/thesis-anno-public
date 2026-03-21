"use server";

import { createClient } from "@/lib/supabase/server";
import { storageDAL } from "@/lib/dal/storage.dal";
import { reviewService } from "@/lib/services/review.service";
import type { ReviewRow } from "@/lib/types/review";
import { getMaxAllowedPages } from "@/lib/config/billing";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

async function resolveMaxPages(): Promise<number> {
  try {
    return await getMaxAllowedPages();
  } catch {
    return 10_000;
  }
}

function parseClientPageCount(
  raw: FormDataEntryValue | null,
  maxPages: number
): { ok: true; pageCount: number } | { ok: false; error: "PAGE_COUNT_REQUIRED" | "PAGE_COUNT_INVALID" } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, error: "PAGE_COUNT_REQUIRED" };
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1 || n > maxPages) {
    return { ok: false, error: "PAGE_COUNT_INVALID" };
  }
  return { ok: true, pageCount: n };
}

export type InitializeReviewResult =
  | { ok: true; reviewId: number; fileName: string; pageCount: number; domain: string }
  | { ok: false; error: string };

export async function initializeReview(formData: FormData): Promise<InitializeReviewResult> {
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

  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "FILE_NOT_PDF" };
  }

  const maxPages = await resolveMaxPages();
  const pc = parseClientPageCount(formData.get("pageCount"), maxPages);
  if (!pc.ok) {
    return { ok: false, error: pc.error };
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const path = await storageDAL.uploadReviewPdf(auth.user.id, file.name, buf);
    const reviewId = await reviewService.insertReview({
      userId: auth.user.id,
      fileUrl: path,
      fileName: file.name,
      domain,
      pageCount: pc.pageCount,
    });
    return { ok: true, reviewId, fileName: file.name, pageCount: pc.pageCount, domain };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[initializeReview]", msg);
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

export type ReplaceReviewPdfResult =
  | { ok: true; fileName: string; pageCount: number }
  | { ok: false; error: string };

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

  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "FILE_NOT_PDF" };
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

  const maxPages = await resolveMaxPages();
  const pc = parseClientPageCount(formData.get("pageCount"), maxPages);
  if (!pc.ok) {
    return { ok: false, error: pc.error };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const oldPath = existing.file_url;

  try {
    const path = await storageDAL.uploadReviewPdf(auth.user.id, file.name, buf);
    await reviewService.updateReviewFile(reviewId, auth.user.id, {
      fileUrl: path,
      fileName: file.name,
      pageCount: pc.pageCount,
    });
    try {
      if (oldPath && oldPath !== path) {
        await storageDAL.removeObject(oldPath);
      }
    } catch (e) {
      console.warn("[replaceReviewPdf] remove old object", e);
    }
    return { ok: true, fileName: file.name, pageCount: pc.pageCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[replaceReviewPdf]", msg);
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}
