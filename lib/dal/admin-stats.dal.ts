import { createAdminClient } from "@/lib/supabase/admin";

/** 与 supportTicketAdminDAL `statusMode: "pending"` 一致：待处理 = open ∪ in_progress */
const PENDING_TICKET_STATUSES = ["open", "in_progress"] as const;

export type AdminDashboardStats = {
  profileCount: number;
  paidOrderCount: number;
  revenueCny: number;
  reviewCount: number;
  pendingTicketCount: number;
};

async function sumPaidOrderAmountCny(): Promise<number> {
  const supabase = createAdminClient();
  const agg = await supabase
    .from("orders")
    .select("amount_paid.sum()")
    .eq("status", "paid")
    .maybeSingle();

  if (!agg.error && agg.data != null) {
    const row = agg.data as unknown as Record<string, string | number | null>;
    const raw = row.sum ?? row["amount_paid.sum()"];
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  }

  const { data, error } = await supabase.from("orders").select("amount_paid").eq("status", "paid");
  if (error) throw new Error(`ADMIN_STATS_SUM_ORDERS: ${error.message}`);
  return (data ?? []).reduce((s, r) => s + Number((r as { amount_paid: string | number }).amount_paid), 0);
}

export const adminStatsDAL = {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const supabase = createAdminClient();

    const [
      profilesRes,
      paidOrdersCountRes,
      reviewsRes,
      pendingTicketsRes,
      revenueCny,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", [...PENDING_TICKET_STATUSES]),
      sumPaidOrderAmountCny(),
    ]);

    const errors = [profilesRes.error, paidOrdersCountRes.error, reviewsRes.error, pendingTicketsRes.error].filter(
      Boolean
    );
    if (errors.length > 0) {
      throw new Error(`ADMIN_STATS: ${errors.map((e) => e!.message).join("; ")}`);
    }

    return {
      profileCount: profilesRes.count ?? 0,
      paidOrderCount: paidOrdersCountRes.count ?? 0,
      revenueCny,
      reviewCount: reviewsRes.count ?? 0,
      pendingTicketCount: pendingTicketsRes.count ?? 0,
    };
  },
};
