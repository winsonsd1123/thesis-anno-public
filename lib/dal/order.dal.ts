import { createAdminClient } from "@/lib/supabase/admin";

export type OrderRow = {
  id: string;
  user_id: string;
  package_id: string;
  amount_paid: number;
  credits_added: number;
  status: "pending" | "paid" | "failed" | "refunded";
  provider_order_id: string | null;
  provider_payment_method: string | null;
  created_at: string;
};

export const orderDAL = {
  async createOrder(
    userId: string,
    packageId: string,
    amountPaid: number,
    creditsAdded: number
  ): Promise<OrderRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        package_id: packageId,
        amount_paid: amountPaid,
        credits_added: creditsAdded,
        status: "pending",
      })
      .select("id, user_id, package_id, amount_paid, credits_added, status, provider_order_id, provider_payment_method, created_at")
      .single();

    if (error) throw error;
    return data as OrderRow;
  },

  async getById(id: string): Promise<OrderRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, package_id, amount_paid, credits_added, status, provider_order_id, provider_payment_method, created_at")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as OrderRow;
  },

  /** Zpay 回调的 out_trade_no 即我们的 order.id */
  async getByOutTradeNo(outTradeNo: string): Promise<OrderRow | null> {
    return this.getById(outTradeNo);
  },

  isAlreadyPaid(order: OrderRow | null): boolean {
    return order?.status === "paid";
  },
};
