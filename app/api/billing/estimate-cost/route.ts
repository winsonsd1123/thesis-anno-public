import { NextResponse } from "next/server";
import { calculateReviewCost, getMaxAllowedWords } from "@/lib/config/billing";
import { DEFAULT_REVIEW_PLAN_OPTIONS } from "@/lib/review/planOptions";
import { normalizePlanOptions } from "@/lib/review/planOptions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = body?.wordCount ?? body?.pageCount;
    const num = typeof raw === "number" ? raw : parseInt(String(raw), 10);

    if (Number.isNaN(num) || num <= 0) {
      return NextResponse.json({ error: "Invalid wordCount" }, { status: 400 });
    }

    const maxWords = await getMaxAllowedWords();
    if (num > maxWords) {
      return NextResponse.json(
        { error: "File too large", maxWords },
        { status: 400 }
      );
    }

    const planOptions = body?.planOptions
      ? normalizePlanOptions(body.planOptions)
      : DEFAULT_REVIEW_PLAN_OPTIONS;

    const result = await calculateReviewCost(num, planOptions);
    if (result === null) {
      return NextResponse.json({ error: "Unable to estimate" }, { status: 400 });
    }

    return NextResponse.json({ cost: result.totalCost, breakdown: result.breakdown });
  } catch (e) {
    console.error("[estimate-cost]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Server error" : String(e) },
      { status: 500 }
    );
  }
}
