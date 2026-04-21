import { createAdminClient } from "@/lib/supabase/admin";
import {
  pickFormatPhysicalExtractFromReviewResult,
  type ReviewResult,
  type ReviewRow,
  type ReviewStageEntry,
  type ReviewStatus,
  type StageAgentStatus,
} from "@/lib/types/review";

export const REVIEW_ADMIN_LIST_LIMIT = 500;

function sanitizeEmailSubstr(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

export type AdminReviewListRow = {
  id: number;
  user_id: string;
  file_name: string | null;
  status: string;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  user_email: string;
};

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
      p_agent: agent,
      p_reason: reason ?? null,
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
      p_reason: reason ?? null,
    });
    if (error) {
      console.error(`FULL_REFUND review=${reviewId}:`, error.message);
      throw new Error(`FULL_REFUND: ${error.message}`);
    }
  },

  /**
   * 运营后台列表：不含 result；按完成时间倒序，再以更新时间倒序。
   */
  async listReviewsForAdmin(filters: { emailSubstr?: string }): Promise<AdminReviewListRow[]> {
    const supabase = createAdminClient();

    const emailPart = filters.emailSubstr ? sanitizeEmailSubstr(filters.emailSubstr) : "";
    let userIdFilter: string[] | null = null;

    if (emailPart.length > 0) {
      const { data: dirRows, error: dirErr } = await supabase
        .from("admin_user_directory")
        .select("id")
        .ilike("email", `%${emailPart}%`)
        .limit(500);
      if (dirErr) throw new Error(`REVIEW_ADMIN_DIR: ${dirErr.message}`);
      userIdFilter = (dirRows ?? []).map((r) => (r as { id: string }).id).filter(Boolean);
      if (userIdFilter.length === 0) return [];
    }

    let q = supabase
      .from("reviews")
      .select("id, user_id, file_name, status, completed_at, updated_at, created_at")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(REVIEW_ADMIN_LIST_LIMIT);

    if (userIdFilter) {
      q = q.in("user_id", userIdFilter);
    }

    const { data, error } = await q;
    if (error) throw new Error(`REVIEW_ADMIN_LIST: ${error.message}`);

    const rows = (data ?? []) as Record<string, unknown>[];
    const userIds = [...new Set(rows.map((r) => String(r.user_id ?? "")).filter(Boolean))];
    const emailByUserId = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: emails, error: eErr } = await supabase
        .from("admin_user_directory")
        .select("id, email")
        .in("id", userIds);
      if (eErr) throw new Error(`REVIEW_ADMIN_EMAILS: ${eErr.message}`);
      for (const row of emails ?? []) {
        const o = row as { id: string; email: string | null };
        emailByUserId.set(o.id, o.email ?? "");
      }
    }

    return rows.map((r) => {
      const user_id = String(r.user_id ?? "");
      return {
        id: Number(r.id),
        user_id,
        file_name: (r.file_name as string | null) ?? null,
        status: String(r.status ?? ""),
        completed_at: (r.completed_at as string | null) ?? null,
        updated_at: String(r.updated_at ?? ""),
        created_at: String(r.created_at ?? ""),
        user_email: emailByUserId.get(user_id) ?? "—",
      };
    });
  },

  async getUserEmailForAdmin(userId: string): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("admin_user_directory")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`REVIEW_ADMIN_USER_EMAIL: ${error.message}`);
    const email = (data as { email: string | null } | null)?.email;
    return email?.trim() ? email : "—";
  },
};
