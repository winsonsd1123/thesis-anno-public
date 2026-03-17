import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPackageById } from "@/lib/config/billing";
import { orderDAL } from "@/lib/dal/order.dal";
import { zpayService } from "@/lib/services/zpay.service";
import { headers } from "next/headers";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const packageId = body?.packageId;
    if (!packageId || typeof packageId !== "string") {
      return NextResponse.json({ error: "Missing packageId" }, { status: 400 });
    }

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    const amountPaid = pkg.price / 100;
    const order = await orderDAL.createOrder(
      data.user.id,
      packageId,
      amountPaid,
      pkg.credits
    );

    const baseUrl = await getBaseUrl();
    const notifyUrl = `${baseUrl}/api/billing/webhook/zpay`;
    const returnUrl = `${baseUrl}/dashboard/billing`;

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
      return NextResponse.json(
        { error: "Failed to get payment URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentUrl,
      orderId: order.id,
    });
  } catch (e) {
    console.error("[create-order]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Server error" : String(e) },
      { status: 500 }
    );
  }
}
