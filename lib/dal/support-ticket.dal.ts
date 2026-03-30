import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewRow } from "@/lib/types/review";

function mapReviewRow(r: Record<string, unknown>): ReviewRow {
  return r as unknown as ReviewRow;
}

export type UserSupportTicketInsertRow = {
  user_id: string;
  review_id: number;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  reporter_email: string | null;
};

/**
 * 用户会话（RLS）：查询自己的审阅、插入自己的工单。调用方须传入 `createClient()` 得到的实例。
 */
export const supportTicketUserDAL = {
  async fetchReviewForUser(
    supabase: SupabaseClient,
    reviewId: number,
    userId: string
  ): Promise<ReviewRow | null> {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`SUPPORT_TICKET_REVIEW_GET: ${error.message}`);
    return data ? mapReviewRow(data as Record<string, unknown>) : null;
  },

  async insertTicket(supabase: SupabaseClient, row: UserSupportTicketInsertRow): Promise<void> {
    const { error } = await supabase.from("support_tickets").insert(row);
    if (error) throw new Error(`SUPPORT_TICKET_INSERT: ${error.message}`);
  },
};
