"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchReviewRow } from "@/lib/browser/fetch-review-row";
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

const POLL_MS = 10_000;

/**
 * Subscribe to `reviews` row updates (stages, status, result, …).
 * 终态时 `router.refresh()`，使历史侧栏的 `initialReviews` 与 RSC 同步（否则仅 Zustand 更新，侧栏需手动刷新才变）。
 * Realtime 断连（CHANNEL_ERROR / TIMED_OUT）时启动 10s Polling，经 GET /api/reviews/:id 拉取，符合三层架构。
 */
export function useReviewRealtime(reviewId: number | null) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  useEffect(() => {
    if (reviewId == null) return;
    const id = reviewId;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startPolling() {
      if (pollTimer != null) return;
      pollTimer = setInterval(async () => {
        const result = await fetchReviewRow(id);
        if (!result.ok) return;
        useDashboardStore.getState().patchFromServer(result.review as unknown as Record<string, unknown>);
        if (isTerminalReviewStatus(result.review.status)) {
          stopPolling();
          routerRef.current.refresh();
        }
      }, POLL_MS);
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`review_progress:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reviews",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const row = payload.new as Record<string, unknown>;
            useDashboardStore.getState().patchFromServer(row);
            if (isTerminalReviewStatus(row.status)) {
              stopPolling();
              routerRef.current.refresh();
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopPolling();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          startPolling();
        }
      });

    return () => {
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [reviewId]);
}
