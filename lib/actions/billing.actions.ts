"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getPackageById,
  estimateCost as estimateCostFromConfig,
  getMaxAllowedPages,
} from "@/lib/config/billing";
import { orderDAL } from "@/lib/dal/order.dal";
import { walletDAL } from "@/lib/dal/wallet.dal";
import { zpayService } from "@/lib/services/zpay.service";
import { headers } from "next/headers";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export type CreateOrderResult = {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
};

export async function createOrder(packageId: string): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return { success: false, error: "请先登录" };
  }

  const pkg = getPackageById(packageId);
  if (!pkg) {
    return { success: false, error: "无效套餐" };
  }

  try {
    const amountPaid = pkg.price / 100;
    const order = await orderDAL.createOrder(
      data.user.id,
      packageId,
      amountPaid,
      pkg.credits
    );

    const baseUrl = await getBaseUrl();
    const notifyUrl = `${baseUrl}/api/billing/webhook/zpay`;
    const returnUrl = `${baseUrl}/dashboard/billing?paid=1`;

    const result = zpayService.createPayment({
      orderId: order.id,
      name: `${pkg.nameZh ?? pkg.name} - ${pkg.credits}次`,
      moneyYuan: amountPaid.toFixed(2),
      notifyUrl,
      returnUrl,
      sitename: "ThesisAI",
    });

    const paymentUrl = result.payurl;
    if (!paymentUrl) {
      return { success: false, error: "获取支付链接失败" };
    }

    return { success: true, paymentUrl, orderId: order.id };
  } catch (e) {
    console.error("[createOrder]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: process.env.NODE_ENV === "production" ? "创建订单失败" : msg,
    };
  }
}

export async function getWalletBalance(): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;

  const wallet = await walletDAL.getWallet(data.user.id);
  return wallet?.credits_balance ?? null;
}

export async function estimateCost(pageCount: number): Promise<{
  cost: number | null;
  error?: string;
}> {
  if (pageCount <= 0 || pageCount > getMaxAllowedPages()) {
    return { cost: null, error: "页数超出范围" };
  }
  const cost = estimateCostFromConfig(pageCount);
  return { cost: cost ?? null, error: cost === null ? "无法估算" : undefined };
}
