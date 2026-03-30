"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import { userInboxService } from "@/lib/services/user-inbox.service";

export type MarkInboxReadResult = { success: true } | { success: false; error: string };

function revalidateUserInboxPaths() {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/dashboard`, "layout");
    revalidatePath(`/${locale}/dashboard/messages`, "layout");
  }
}

export async function markInboxMessageRead(messageId: string): Promise<MarkInboxReadResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { success: false, error: "请先登录" };

  try {
    await userInboxService.markReadIfUnread(messageId, data.user.id);
    revalidateUserInboxPaths();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
