import { NextResponse } from "next/server";
import { zpayService } from "@/lib/services/zpay.service";
import { orderDAL } from "@/lib/dal/order.dal";
import { transactionService } from "@/lib/services/transaction.service";

/**
 * Zpay 异步通知。文档说明请求方法为 GET。
 * 同时支持 POST 以兼容不同配置。
 */
async function handleWebhook(params: Record<string, string | undefined>) {
  if (!zpayService.verifyNotifySign(params)) {
    return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
  }

  if (params.trade_status !== "TRADE_SUCCESS") {
    return new NextResponse("success", { status: 200 });
  }

  const outTradeNo = params.out_trade_no;
  const tradeNo = params.trade_no;
  const money = params.money;
  const payType = params.type ?? "";

  if (!outTradeNo || !tradeNo || !money) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const order = await orderDAL.getByOutTradeNo(outTradeNo);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (orderDAL.isAlreadyPaid(order)) {
    return new NextResponse("success", { status: 200 });
  }

  const expectedMoney = Number(order.amount_paid).toFixed(2);
  const actualMoney = Number(money).toFixed(2);
  if (expectedMoney !== actualMoney) {
    return NextResponse.json(
      { error: `Amount mismatch: expected ${expectedMoney}, got ${actualMoney}` },
      { status: 400 }
    );
  }

  await transactionService.deposit(order.id, tradeNo, payType);

  return new NextResponse("success", { status: 200 });
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
