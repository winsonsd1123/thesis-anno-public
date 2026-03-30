"use client";

import { useEffect, useRef } from "react";
import { markInboxMessageRead } from "@/lib/actions/user-inbox.actions";

/**
 * 进入详情后标记已读（POST Server Action），避免在 RSC render 中写库。
 */
export function InboxMarkReadOnOpen({ messageId }: { messageId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void markInboxMessageRead(messageId);
  }, [messageId]);

  return null;
}
