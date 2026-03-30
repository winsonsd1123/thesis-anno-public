"use server";

import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { sendAdminInboxMessageSchema } from "@/lib/schemas/user-inbox.schema";
import { userInboxAdminService } from "@/lib/services/user-inbox.admin.service";
import { getAdminUserOrNull } from "@/lib/utils/admin";

export type SendAdminInboxMessageResult =
  | { success: true }
  | { success: false; error: string };

function revalidateInboxRelatedPaths() {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/admin/messages`, "page");
    revalidatePath(`/${locale}/dashboard`, "layout");
    revalidatePath(`/${locale}/dashboard/messages`, "layout");
  }
}

export async function sendAdminInboxMessage(
  _prev: unknown,
  formData: FormData
): Promise<SendAdminInboxMessageResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "无权限" };

  const parsed = sendAdminInboxMessageSchema.safeParse({
    recipientEmail: formData.get("recipientEmail") ?? "",
    senderDisplayName: formData.get("senderDisplayName") ?? "",
    body: formData.get("body") ?? "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  try {
    await userInboxAdminService.sendFromAdmin(admin.userId, {
      recipientEmail: parsed.data.recipientEmail,
      senderDisplayName: parsed.data.senderDisplayName,
      body: parsed.data.body,
    });
    revalidateInboxRelatedPaths();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
