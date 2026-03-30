import { createAdminClient } from "@/lib/supabase/admin";
import {
  pickFormatPhysicalExtractFromReviewResult,
  type ReviewResult,
  type ReviewRow,
  type ReviewStageEntry,
  type ReviewStatus,
  type StageAgentStatus,
} from "@/lib/types/review";

/**
 * 仅用于无用户 JWT 的后台任务（如 Trigger.dev）更新审阅行。
 * 禁止在用户会话路径中调用 —— 用户写操作应走 review.dal + RLS。
 */
export const reviewAdminDAL = {
  async getReviewById(reviewId: number): Promise<ReviewRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("reviews").select("*").eq("id", reviewId).maybeSingle();
    if (error) throw new Error(`REVIEW_ADMIN_GET: ${error.message}`);
    return data ? (data as unknown as ReviewRow) : null;
  },

  /**
   * 单条原子更新（Postgres RPC），避免并行 agent 读改写互相覆盖导致 UI 只显示部分进度。
   */
  async updateStageStatus(
    reviewId: number,
    agent: ReviewStageEntry["agent"],
    status: StageAgentStatus,
    log?: string
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("admin_patch_review_stage", {
      p_review_id: reviewId,
      p_agent: agent,
      p_status: status,
      p_log: log !== undefined && log !== "" ? log : null,
    });
    if (error) throw new Error(`REVIEW_ADMIN_STAGES_PATCH: ${error.message}`);
  },

  async completeReview(reviewId: number, result: ReviewResult): Promise<void> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("reviews")
      .update({
        status: "completed",
        result,
        format_physical_extract: pickFormatPhysicalExtractFromReviewResult(result),
        completed_at: now,
        updated_at: now,
      })
      .eq("id", reviewId);
    if (error) throw new Error(`REVIEW_ADMIN_COMPLETE: ${error.message}`);
  },

  async suspendToManualReview(reviewId: number, errorMessage: string): Promise<void> {
    const supabase = createAdminClient();
    const { data: review, error: loadErr } = await supabase
      .from("reviews")
      .select("user_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (loadErr) throw new Error(`REVIEW_ADMIN_SUSPEND_LOAD: ${loadErr.message}`);
    if (!review?.user_id) return;

    const { error: upErr } = await supabase
      .from("reviews")
      .update({
        status: "needs_manual_review",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId);
    if (upErr) throw new Error(`REVIEW_ADMIN_SUSPEND: ${upErr.message}`);

    let reporterEmail: string | null = null;
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(review.user_id);
    if (!authErr && authUser?.user?.email) {
      reporterEmail = authUser.user.email;
    }

    const { error: ticketErr } = await supabase.from("support_tickets").insert({
      user_id: review.user_id,
      review_id: reviewId,
      category: "system_error",
      subject: `审阅任务 #${reviewId} 自动挂起`,
      description: `Task failed after orchestration. Error: ${errorMessage}`,
      status: "open",
      priority: "high",
      reporter_email: reporterEmail,
    });
    if (ticketErr) throw new Error(`REVIEW_ADMIN_TICKET: ${ticketErr.message}`);
  },

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
        format_physical_extract: pickFormatPhysicalExtractFromReviewResult(result),
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

  /**
   * 退还单个 agent 的费用快照（幂等）。
   * 退款额从 reviews.cost_breakdown 读取，禁止调用方传入金额。
   */
  async partialRefundReviewStage(
    reviewId: number,
    agent: "format" | "logic" | "aitrace" | "reference",
    reason?: string
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("admin_partial_refund_review_stage", {
      p_review_id: reviewId,
      p_agent:     agent,
      p_reason:    reason ?? null,
    });
    if (error) {
      console.error(`PARTIAL_REFUND_STAGE[${agent}] review=${reviewId}:`, error.message);
      throw new Error(`PARTIAL_REFUND_STAGE: ${error.message}`);
    }
  },

  /**
   * 所有已启用 agent 全部失败时，全额退款并将任务重置为 pending 供用户重试。
   * 仅在 status = 'processing' 时可用。
   */
  async fullRefundProcessingReview(reviewId: number, reason?: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("admin_full_refund_processing_review", {
      p_review_id: reviewId,
      p_reason:    reason ?? null,
    });
    if (error) {
      console.error(`FULL_REFUND review=${reviewId}:`, error.message);
      throw new Error(`FULL_REFUND: ${error.message}`);
    }
  },
};
