import { createAdminClient } from "@/lib/supabase/admin";

export type WalletRow = {
  user_id: string;
  credits_balance: number;
  version: number;
};

export const walletDAL = {
  async getWallet(userId: string): Promise<WalletRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_wallets")
      .select("user_id, credits_balance, version")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;
    return data as WalletRow;
  },

  /**
   * 原子充值：更新订单、加余额、插入流水。
   * 使用数据库函数保证事务一致性。
   */
  async addCredits(
    userId: string,
    orderId: string,
    credits: number,
    providerOrderId: string,
    providerMethod: string
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("add_credits_deposit", {
      p_user_id: userId,
      p_order_id: orderId,
      p_credits: credits,
      p_provider_order_id: providerOrderId,
      p_provider_method: providerMethod,
    });

    if (error) throw error;
  },
};
