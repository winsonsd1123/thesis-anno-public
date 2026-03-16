"use server";

import { createClient } from "@/lib/supabase/server";
import { userService } from "@/lib/services/user.service";
import { updateProfileSchema } from "@/lib/schemas/profile.schema";
import type { UserProfileDTO } from "@/lib/dtos/user.dto";

export type ProfileActionResult = {
  success: boolean;
  error?: string;
};

export async function getProfile(): Promise<UserProfileDTO | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;
  return userService.getProfile(data.user.id);
}

export async function updateProfile(
  _prev: unknown,
  formData: FormData
): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return { success: false, error: "请先登录" };
  }

  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName") || undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  const updateData = parsed.data;
  if (!updateData.fullName && !updateData.avatarUrl) {
    return { success: false, error: "请至少修改一项" };
  }

  try {
    await userService.updateProfile(data.user.id, {
      fullName: updateData.fullName,
      avatarUrl: updateData.avatarUrl,
    });
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: process.env.NODE_ENV === "production" ? "更新失败" : String(e),
    };
  }
}
