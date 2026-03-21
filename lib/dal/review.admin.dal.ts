import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewResult, ReviewStageEntry, ReviewStatus } from "@/lib/types/review";

/**
 * 仅用于无用户 JWT 的后台任务（如 Trigger.dev）更新审阅行。
 * 禁止在用户会话路径中调用 —— 用户写操作应走 review.dal + RLS。
 */
export const reviewAdminDAL = {
  async updateStatus(reviewId: number, userId: string, status: ReviewStatus): Promise<void> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_UPDATE_STATUS: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  async updateStages(reviewId: number, userId: string, stages: ReviewStageEntry[]): Promise<void> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({ stages, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_STAGES: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  async setCompleted(reviewId: number, userId: string, result: ReviewResult): Promise<void> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("reviews")
      .update({
        status: "completed",
        result,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_COMPLETE: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  async setFailed(
    reviewId: number,
    userId: string,
    errorMessage: string,
    status: "failed" | "needs_manual_review"
  ): Promise<void> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_FAIL: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },
};
