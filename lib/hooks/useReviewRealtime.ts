"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboardStore } from "@/lib/store/useDashboardStore";

function isTerminalReviewStatus(status: unknown): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "needs_manual_review" ||
    status === "refunded" ||
    status === "cancelled"
  );
}

/**
 * Subscribe to `reviews` row updates (stages, status, result, …).
 * 终态时 `router.refresh()`，使历史侧栏的 `initialReviews` 与 RSC 同步（否则仅 Zustand 更新，侧栏需手动刷新才变）。
 */
export function useReviewRealtime(reviewId: number | null) {
  const router = useRouter();

  useEffect(() => {
    if (reviewId == null) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`review_progress:${reviewId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reviews",
          filter: `id=eq.${reviewId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const row = payload.new as Record<string, unknown>;
            useDashboardStore.getState().patchFromServer(row);
            if (isTerminalReviewStatus(row.status)) {
              router.refresh();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reviewId, router]);
}
