import { walletDAL } from "@/lib/dal/wallet.dal";
import { orderDAL } from "@/lib/dal/order.dal";

/**
 * 充值：更新订单、加余额、插入流水。
 * 由 walletDAL.addCredits 调用数据库函数原子完成。
 */
export const transactionService = {
  async deposit(
    orderId: string,
    providerOrderId: string,
    providerMethod: string
  ): Promise<void> {
    const order = await orderDAL.getById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status === "paid") {
      return; // 幂等
    }
    if (order.status !== "pending") {
      throw new Error(`Invalid order status: ${order.status}`);
    }

    await walletDAL.addCredits(
      order.user_id,
      orderId,
      order.credits_added,
      providerOrderId,
      providerMethod
    );
  },
};
