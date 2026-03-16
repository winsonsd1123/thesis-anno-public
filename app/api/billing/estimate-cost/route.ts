import { NextResponse } from "next/server";
import { estimateCost, getMaxAllowedPages } from "@/lib/config/billing";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pageCount = body?.pageCount;
    const num = typeof pageCount === "number" ? pageCount : parseInt(String(pageCount), 10);

    if (Number.isNaN(num) || num <= 0) {
      return NextResponse.json({ error: "Invalid pageCount" }, { status: 400 });
    }

    if (num > getMaxAllowedPages()) {
      return NextResponse.json(
        { error: "File too large", maxPages: getMaxAllowedPages() },
        { status: 400 }
      );
    }

    const cost = estimateCost(num);
    if (cost === null) {
      return NextResponse.json({ error: "Unable to estimate" }, { status: 400 });
    }

    return NextResponse.json({ cost });
  } catch (e) {
    console.error("[estimate-cost]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Server error" : String(e) },
      { status: 500 }
    );
  }
}
