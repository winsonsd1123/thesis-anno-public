"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboardStore } from "@/lib/store/useDashboardStore";

/**
 * Subscribe to `reviews` row updates (stages, status, result, …).
 */
export function useReviewRealtime(reviewId: number | null) {
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
            useDashboardStore.getState().patchFromServer(payload.new as Record<string, unknown>);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reviewId]);
}
