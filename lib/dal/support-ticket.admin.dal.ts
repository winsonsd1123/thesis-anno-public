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
  reviews?: { file_name: string | null; status: string } | null;
};

/**
 * 仅供 Admin 使用，通过 createAdminClient 绕过 RLS，列出所有工单。
 */
export const supportTicketAdminDAL = {
  async listOpenTickets(): Promise<SupportTicketRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, user_id, review_id, category, subject, description, status, priority, resolution, admin_id, created_at, updated_at, reviews(file_name, status)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });

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
