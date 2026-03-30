import { z } from "zod";
import { emailSchema } from "@/lib/schemas/auth.schema";

export const sendAdminInboxMessageSchema = z.object({
  recipientEmail: emailSchema,
  senderDisplayName: z
    .string()
    .trim()
    .min(1, "请填写发件人显示名")
    .max(100, "发件人显示名最多 100 个字符"),
  body: z.string().trim().min(1, "请填写正文").max(20000, "正文过长"),
});

export type SendAdminInboxMessageInput = z.infer<typeof sendAdminInboxMessageSchema>;
