import { createClient } from "@/lib/supabase/server";
import type { ReviewRow, ReviewStageEntry } from "@/lib/types/review";

function mapRow(r: Record<string, unknown>): ReviewRow {
  return r as unknown as ReviewRow;
}

export const reviewDAL = {
  async listByUser(userId: string): Promise<ReviewRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`REVIEW_LIST: ${error.message}`);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async getByIdForUser(reviewId: number, userId: string): Promise<ReviewRow | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`REVIEW_GET: ${error.message}`);
    return data ? mapRow(data as Record<string, unknown>) : null;
  },

  async insertReview(input: {
    userId: string;
    fileUrl: string;
    fileName: string;
    domain: string;
    pageCount: number | null;
  }): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: input.userId,
        file_url: input.fileUrl,
        file_name: input.fileName,
        domain: input.domain,
        page_count: input.pageCount,
        status: "pending",
        cost: 0,
        stages: [],
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`REVIEW_INSERT: ${error?.message ?? "no row"}`);
    return data.id as number;
  },

  async renameReview(reviewId: number, userId: string, name: string): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({ file_name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_RENAME: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  async deleteReview(reviewId: number, userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("file_url")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_DELETE: ${error.message}`);
    return (data as { file_url: string } | null)?.file_url ?? null;
  },

  async updateReviewFile(
    reviewId: number,
    userId: string,
    input: { fileUrl: string; fileName: string; pageCount: number | null }
  ): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({
        file_url: input.fileUrl,
        file_name: input.fileName,
        page_count: input.pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_UPDATE_FILE: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  async updateDomain(reviewId: number, userId: string, domain: string): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({ domain, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_UPDATE_DOMAIN: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  /** 用户会话内启动审阅（Action 有 JWT）；RLS 校验 user_id。 */
  async updateProcessingStart(input: {
    reviewId: number;
    userId: string;
    cost: number;
    stages: ReviewStageEntry[];
    triggerRunId: string | null;
  }): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({
        status: "processing",
        cost: input.cost,
        stages: input.stages,
        trigger_run_id: input.triggerRunId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.reviewId)
      .eq("user_id", input.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_START: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },

  /** 扣费与 processing 已由 `start_review_and_deduct` 完成；仅回写 Trigger run id。 */
  async updateTriggerRunId(reviewId: number, userId: string, triggerRunId: string | null): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .update({
        trigger_run_id: triggerRunId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`REVIEW_TRIGGER_RUN: ${error.message}`);
    if (!data) throw new Error("REVIEW_NOT_FOUND");
  },
};
