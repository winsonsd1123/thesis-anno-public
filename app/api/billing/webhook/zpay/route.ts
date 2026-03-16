import { NextResponse } from "next/server";
import { zpayService } from "@/lib/services/zpay.service";
import { orderDAL } from "@/lib/dal/order.dal";
import { transactionService } from "@/lib/services/transaction.service";

/**
 * Zpay 异步通知。Zpay 文档规定支付结果通知请求方法为 GET，必须支持。
 * 同时支持 POST 以兼容可能的未来变更。
 * 注意：必须返回 "success" 文本，否则 Zpay 会重试。
 */
async function handleWebhook(params: Record<string, string | undefined>) {
  const successResponse = () => new NextResponse("success", { status: 200 });

  if (!zpayService.verifyNotifySign(params)) {
    console.error("[zpay webhook] Invalid sign", { out_trade_no: params.out_trade_no });
    return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
  }

  if (params.trade_status !== "TRADE_SUCCESS") {
    return successResponse();
  }

  const outTradeNo = params.out_trade_no;
  const tradeNo = params.trade_no;
  const money = params.money;
  const payType = params.type ?? "";

  if (!outTradeNo || !tradeNo || !money) {
    console.error("[zpay webhook] Missing params", params);
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const order = await orderDAL.getByOutTradeNo(outTradeNo);
  if (!order) {
    console.error("[zpay webhook] Order not found", outTradeNo);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (orderDAL.isAlreadyPaid(order)) {
    return successResponse();
  }

  const expectedMoney = Number(order.amount_paid).toFixed(2);
  const actualMoney = Number(money).toFixed(2);
  if (expectedMoney !== actualMoney) {
    console.error("[zpay webhook] Amount mismatch", { expected: expectedMoney, actual: actualMoney });
    return NextResponse.json(
      { error: `Amount mismatch: expected ${expectedMoney}, got ${actualMoney}` },
      { status: 400 }
    );
  }

  try {
    await transactionService.deposit(order.id, tradeNo, payType);
    console.log("[zpay webhook] Deposit success", { orderId: order.id, credits: order.credits_added });
  } catch (e) {
    console.error("[zpay webhook] Deposit failed", e);
    return NextResponse.json({ error: "Deposit failed" }, { status: 500 });
  }

  return successResponse();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | undefined> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return handleWebhook(params);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let params: Record<string, string | undefined> = {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const searchParams = new URLSearchParams(text);
    searchParams.forEach((v, k) => {
      params[k] = v;
    });
  } else if (contentType.includes("application/json")) {
    const body = await request.json();
    params = body as Record<string, string | undefined>;
  } else {
    const { searchParams } = new URL(request.url);
    searchParams.forEach((v, k) => {
      params[k] = v;
    });
  }

  return handleWebhook(params);
}
