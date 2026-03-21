"use server";

import { createClient } from "@/lib/supabase/server";
import { reviewService } from "@/lib/services/review.service";
import { walletDAL } from "@/lib/dal/wallet.dal";
import { estimateCost, getMaxAllowedPages } from "@/lib/config/billing";
import { INITIAL_REVIEW_STAGES } from "@/lib/types/review";

export type StartReviewResult =
  | { ok: true; triggerRunId: string | null }
  | { ok: false; error: string };

/**
 * Validates wallet, writes processing + stages, optionally triggers Trigger.dev job.
 * Credit consumption RPC — TODO: call atomic consume when available.
 */
export async function startReviewEngine(reviewId: number): Promise<StartReviewResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };

  const review = await reviewService.getReviewForUser(reviewId, auth.user.id);
  if (!review) return { ok: false, error: "NOT_FOUND" };
  if (review.status !== "pending") {
    return { ok: false, error: "INVALID_STATUS" };
  }

  const pages = review.page_count ?? 1;
  const maxPages = await getMaxAllowedPages();
  if (pages < 1 || pages > maxPages) {
    return { ok: false, error: "PAGE_COUNT_OUT_OF_RANGE" };
  }

  const cost = await estimateCost(pages);
  if (cost === null) {
    return { ok: false, error: "COST_UNAVAILABLE" };
  }

  const wallet = await walletDAL.getWallet(auth.user.id);
  const balance = wallet?.credits_balance ?? 0;
  if (balance < cost) {
    return { ok: false, error: "INSUFFICIENT_CREDITS" };
  }

  // TODO: deduct credits atomically (review id as reference_id) before starting engine
  let triggerRunId: string | null = null;

  const secret = process.env.TRIGGER_SECRET_KEY;
  if (secret) {
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      const handle = await tasks.trigger("orchestrate-review", {
        reviewId: review.id,
        fileUrl: review.file_url,
        domain: review.domain,
        userId: auth.user.id,
      });
      triggerRunId = handle?.id ?? null;
    } catch (e) {
      console.warn("[startReviewEngine] Trigger.dev trigger failed:", e);
    }
  }

  try {
    await reviewService.updateProcessingStart({
      reviewId: review.id,
      userId: auth.user.id,
      cost,
      stages: INITIAL_REVIEW_STAGES,
      triggerRunId,
    });
    return { ok: true, triggerRunId };
  } catch (e) {
    console.error("[startReviewEngine]", e);
    return { ok: false, error: "START_FAILED" };
  }
}
