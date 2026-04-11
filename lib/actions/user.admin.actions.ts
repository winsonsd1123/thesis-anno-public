"use server";

import { revalidatePath } from "next/cache";
import { getAdminUserOrNull } from "@/lib/utils/admin";
import {
  UserAdminPolicyError,
  userAdminService,
} from "@/lib/services/user.admin.service";

type ActionOk = { success: true };
type ActionFail = { success: false; error: string; code?: string };
export type UserAdminActionResult = ActionOk | ActionFail;

function mapErr(err: unknown): ActionFail {
  if (err instanceof UserAdminPolicyError) {
    return { success: false, error: err.message, code: err.code };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: msg };
}

export async function adminCreateUser(
  email: string,
  password: string
): Promise<{ success: true; userId: string } | ActionFail> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };
  try {
    const userId = await userAdminService.createUser(admin.userId, email, password);
    return { success: true, userId };
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_INPUT") {
      return { success: false, error: "INVALID_INPUT" };
    }
    return mapErr(e);
  }
}

export async function adminUpdateUser(
  targetUserId: string,
  patch: { fullName?: string | null; role?: "user" | "admin"; isDisabled?: boolean }
): Promise<UserAdminActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };
  try {
    await userAdminService.updateUser(admin.userId, targetUserId, patch);
    return { success: true };
  } catch (e) {
    return mapErr(e);
  }
}

/**
 * @param revalidateLocale 当前界面 locale（zh | en），用于删除后刷新用户列表缓存，避免仅依赖客户端 router.refresh（在已删除资源的页面上易卡住）。
 */
export async function adminDeleteUser(
  targetUserId: string,
  revalidateLocale?: string
): Promise<UserAdminActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };
  try {
    await userAdminService.deleteUser(admin.userId, targetUserId);
    if (revalidateLocale === "en" || revalidateLocale === "zh") {
      revalidatePath(`/${revalidateLocale}/admin/users`, "page");
    }
    return { success: true };
  } catch (e) {
    return mapErr(e);
  }
}
