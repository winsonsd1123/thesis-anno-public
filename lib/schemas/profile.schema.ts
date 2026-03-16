import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, "昵称至少 2 个字符")
    .max(50, "昵称最多 50 个字符")
    .optional(),
  avatarUrl: z.string().url("请输入有效的头像 URL").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
