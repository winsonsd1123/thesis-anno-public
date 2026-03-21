import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reviewService } from "@/lib/services/review.service";

/**
 * 审阅详情（只读）— 使用 GET，符合「读操作用 GET」约定；勿用 Server Action 做纯查询。
 */
export async function GET(_request: Request, segment: { params: Promise<{ id: string }> }) {
  const { id: raw } = await segment.params;
  const reviewId = parseInt(raw, 10);
  if (!Number.isFinite(reviewId) || reviewId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const review = await reviewService.getReviewForUser(reviewId, auth.user.id);
    if (!review) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ review }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[GET /api/reviews/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
