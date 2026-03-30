import { createAdminClient } from "@/lib/supabase/admin";

export type SupportTicketRow = {
  id: string;
  user_id: string;
  review_id: number | null;
  category: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string | null;
  resolution: string | null;
  admin_id: string | null;
  created_at: string;
  updated_at: string | null;
  reporter_email?: string | null;
  reviews?: { file_name: string | null; status: string } | null;
};

/** 与 admin 列表 GET 筛选一致 */
export type SupportTicketListFilters = {
  statusMode: "open" | "pending" | "all" | "resolved" | "closed" | "in_progress";
  createdAfter?: string;
  createdBefore?: string;
  /** 已清洗的子串（不含 % _ \\），空则不过滤 */
  emailSubstr?: string;
};

const TICKET_LIST_LIMIT = 500;

function sanitizeEmailSubstr(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

/**
 * 仅供 Admin 使用，通过 createAdminClient 绕过 RLS，列出工单。
 */
export const supportTicketAdminDAL = {
  /**
   * 按筛选条件列出工单（创建时间倒序，上限 TICKET_LIST_LIMIT）。
   * `filters.emailSubstr` 应为已清洗子串；也可传入原始字符串由本方法清洗。
   */
  async listTicketsFiltered(filters: SupportTicketListFilters): Promise<SupportTicketRow[]> {
    const supabase = createAdminClient();
    let q = supabase
      .from("support_tickets")
      .select(
        "id, user_id, review_id, category, subject, description, status, priority, resolution, admin_id, created_at, updated_at, reporter_email, reviews(file_name, status)"
      );

    const { statusMode } = filters;
    if (statusMode === "open") {
      q = q.eq("status", "open");
    } else if (statusMode === "pending") {
      q = q.in("status", ["open", "in_progress"]);
    } else if (statusMode === "resolved") {
      q = q.eq("status", "resolved");
    } else if (statusMode === "closed") {
      q = q.eq("status", "closed");
    } else if (statusMode === "in_progress") {
      q = q.eq("status", "in_progress");
    }

    if (filters.createdAfter) {
      q = q.gte("created_at", filters.createdAfter);
    }
    if (filters.createdBefore) {
      q = q.lte("created_at", filters.createdBefore);
    }

    const emailPart = filters.emailSubstr ? sanitizeEmailSubstr(filters.emailSubstr) : "";
    if (emailPart.length > 0) {
      q = q.ilike("reporter_email", `%${emailPart}%`);
    }

    const { data, error } = await q.order("created_at", { ascending: false }).limit(TICKET_LIST_LIMIT);

    if (error) throw new Error(`TICKET_LIST: ${error.message}`);
    return (data ?? []) as unknown as SupportTicketRow[];
  },

  async resolveTicketOnly(
    ticketId: string,
    adminId: string,
    resolution: string
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: "resolved",
        resolution,
        admin_id: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .eq("status", "open");

    if (error) throw new Error(`TICKET_RESOLVE: ${error.message}`);
  },
};
