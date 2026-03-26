import { NextResponse } from "next/server";
import { estimateCostByWords, getMaxAllowedWords } from "@/lib/config/billing";

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

    const cost = await estimateCostByWords(num);
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
