"use server";

import { createClient } from "@/lib/supabase/server";
import { reviewService } from "@/lib/services/review.service";
import { calculateReviewCost, getMaxAllowedWords } from "@/lib/config/billing";
import type { ReviewPlanOptions } from "@/lib/types/review";
import { normalizePlanOptions, planHasAtLeastOneEnabled } from "@/lib/review/planOptions";

export type StartReviewResult =
  | { ok: true; triggerRunId: string | null }
  | { ok: false; error: string };

function mapStartReviewRpcError(message: string): string {
  const m = message.toUpperCase();
  if (m.includes("INSUFFICIENT_CREDITS")) return "INSUFFICIENT_CREDITS";
  if (m.includes("PLAN_EMPTY")) return "PLAN_EMPTY";
  if (m.includes("INVALID_STATUS")) return "INVALID_STATUS";
  if (m.includes("REVIEW_NOT_FOUND")) return "NOT_FOUND";
  if (m.includes("NOT_AUTHENTICATED")) return "NOT_AUTHENTICATED";
  if (m.includes("WALLET_NOT_FOUND")) return "WALLET_NOT_FOUND";
  if (m.includes("INVALID_CREDITS")) return "INVALID_CREDITS";
  if (m.includes("BREAKDOWN_MISMATCH")) return "START_FAILED";
  return "START_FAILED";
}

function mapRollbackRpcError(message: string): string {
  const m = message.toUpperCase();
  if (m.includes("REVIEW_NOT_FOUND")) return "NOT_FOUND";
  if (m.includes("NOT_AUTHENTICATED")) return "NOT_AUTHENTICATED";
  if (m.includes("INVALID_STATUS")) return "INVALID_STATUS";
  if (m.includes("RUN_ALREADY_ATTACHED")) return "RUN_ALREADY_ATTACHED";
  if (m.includes("INVALID_COST")) return "ROLLBACK_INVALID_COST";
  if (m.includes("WALLET_NOT_FOUND")) return "WALLET_NOT_FOUND";
  return "ROLLBACK_FAILED";
}

/**
 * 顺序：RPC 扣费 + processing → tasks.trigger → 回写 trigger_run_id。
 * Trigger 未配置、派发失败或未取得 run id 时：调用 rollback_review_after_dispatch_failure（pending + 退款）。
 */
function normalizeUiLocale(raw: unknown): "zh" | "en" {
  return raw === "en" ? "en" : "zh";
}

export async function startReviewEngine(
  reviewId: number,
  planOptionsInput?: ReviewPlanOptions,
  uiLocale?: "zh" | "en"
): Promise<StartReviewResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };

  const review = await reviewService.getReviewForUser(reviewId, auth.user.id);
  if (!review) return { ok: false, error: "NOT_FOUND" };
  if (review.status !== "pending") {
    return { ok: false, error: "INVALID_STATUS" };
  }

  const plan = normalizePlanOptions(planOptionsInput ?? review.plan_options);
  if (!planHasAtLeastOneEnabled(plan)) {
    return { ok: false, error: "PLAN_EMPTY" };
  }

  if (plan.format) {
    const fg = typeof review.format_guidelines === "string" ? review.format_guidelines.trim() : "";
    if (!fg) {
      return { ok: false, error: "FORMAT_GUIDELINES_REQUIRED" };
    }
  }

  const wc = review.word_count;
  if (wc == null || wc < 1) {
    return { ok: false, error: "WORD_COUNT_OUT_OF_RANGE" };
  }

  const maxWords = await getMaxAllowedWords();
  if (wc > maxWords) {
    return { ok: false, error: "WORD_COUNT_OUT_OF_RANGE" };
  }

  const costResult = await calculateReviewCost(wc, plan);
  if (costResult === null) {
    return { ok: false, error: "COST_UNAVAILABLE" };
  }

  const { error: rpcError } = await supabase.rpc("start_review_and_deduct", {
    p_review_id:      reviewId,
    p_total_cost:     costResult.totalCost,
    p_cost_breakdown: costResult.breakdown,
    p_plan_options:   plan,
  });

  if (rpcError) {
    const code = mapStartReviewRpcError(rpcError.message ?? "");
    return { ok: false, error: code };
  }

  const secret = process.env.TRIGGER_SECRET_KEY?.trim();
  if (!secret) {
    console.error("[startReviewEngine] TRIGGER_SECRET_KEY missing after deduct; rolling back.");
    const rb = await supabase.rpc("rollback_review_after_dispatch_failure", {
      p_review_id: reviewId,
    });
    if (rb.error) {
      console.error("[startReviewEngine] rollback after missing secret failed:", rb.error);
      return { ok: false, error: mapRollbackRpcError(rb.error.message ?? "") };
    }
    return { ok: false, error: "TRIGGER_NOT_CONFIGURED" };
  }

  let triggerRunId: string | null = null;
  try {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    const handle = await tasks.trigger("orchestrate-review", {
      reviewId,
      uiLocale: normalizeUiLocale(uiLocale),
    });
    triggerRunId = handle?.id ?? null;
  } catch (e) {
    console.error("[startReviewEngine] Trigger.dev trigger failed after deduct:", e);
    const rb = await supabase.rpc("rollback_review_after_dispatch_failure", {
      p_review_id: reviewId,
    });
    if (rb.error) {
      console.error("[startReviewEngine] rollback after trigger error failed:", rb.error);
      return { ok: false, error: mapRollbackRpcError(rb.error.message ?? "") };
    }
    return { ok: false, error: "TRIGGER_DISPATCH_FAILED" };
  }

  if (!triggerRunId) {
    console.error("[startReviewEngine] trigger returned empty run id; rolling back.");
    const rb = await supabase.rpc("rollback_review_after_dispatch_failure", {
      p_review_id: reviewId,
    });
    if (rb.error) {
      console.error("[startReviewEngine] rollback after empty run id failed:", rb.error);
      return { ok: false, error: mapRollbackRpcError(rb.error.message ?? "") };
    }
    return { ok: false, error: "TRIGGER_DISPATCH_FAILED" };
  }

  try {
    await reviewService.updateTriggerRunId(review.id, auth.user.id, triggerRunId);
  } catch (e) {
    console.error("[startReviewEngine] updateTriggerRunId", e);
    return { ok: false, error: "START_FAILED" };
  }

  return { ok: true, triggerRunId };
}
