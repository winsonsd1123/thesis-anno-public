"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUserOrNull } from "@/lib/utils/admin";
import { supportTicketAdminDAL } from "@/lib/dal/support-ticket.admin.dal";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * 退款并结案：全额退还挂起审阅的积分，同时将工单标记为 resolved。
 * 对应 needs_manual_review 状态的审阅，调用原子 RPC。
 */
export async function refundSuspendedReviewAndResolveTicket(
  ticketId: string
): Promise<ActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "admin_refund_needs_manual_review_and_resolve_ticket",
    {
      p_ticket_id: ticketId,
      p_admin_id: admin.userId,
      p_reason: null,
    }
  );

  if (error) {
    console.error(`TICKET_REFUND_RESOLVE ticket=${ticketId}:`, error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * 仅结案：只更新工单状态为 resolved，不修改关联审阅（用于非退款场景）。
 */
export async function resolveSupportTicketOnly(
  ticketId: string,
  resolution?: string
): Promise<ActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };

  try {
    await supportTicketAdminDAL.resolveTicketOnly(
      ticketId,
      admin.userId,
      resolution ?? "管理员手动结案"
    );
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`TICKET_RESOLVE_ONLY ticket=${ticketId}:`, msg);
    return { success: false, error: msg };
  }
}
