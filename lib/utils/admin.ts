import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileDAL } from "@/lib/dal/profile.dal";

/**
 * 校验当前用户为 admin，否则重定向到 /dashboard。
 * 用于 Admin 布局（Server Component）。
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const admin = await getAdminUserOrNull();
  if (!admin) redirect("/dashboard");
  return admin;
}

/**
 * 获取当前 admin 用户，非 admin 返回 null。
 * 用于 API Route，可据此返回 403。
 */
export async function getAdminUserOrNull(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) return null;

  const profile = await profileDAL.getById(data.user.id);
  if (profile?.role !== "admin") return null;

  return { userId: data.user.id };
}
