import type { ReviewRow } from "@/lib/types/review";

export type FetchReviewRowResult =
  | { ok: true; review: ReviewRow }
  | { ok: false; error: "NOT_AUTHENTICATED" | "NOT_FOUND" | "UNKNOWN" };

/**
 * 通过 GET /api/reviews/:id 拉取当前用户的审阅详情（供 Client Component 使用）。
 */
export async function fetchReviewRow(reviewId: number): Promise<FetchReviewRowResult> {
  const res = await fetch(`/api/reviews/${reviewId}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (res.status === 401) return { ok: false, error: "NOT_AUTHENTICATED" };
  if (res.status === 404) return { ok: false, error: "NOT_FOUND" };
  if (!res.ok) return { ok: false, error: "UNKNOWN" };

  try {
    const body = (await res.json()) as { review?: ReviewRow };
    if (!body?.review || typeof body.review.id !== "number") {
      return { ok: false, error: "NOT_FOUND" };
    }
    return { ok: true, review: body.review };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}
