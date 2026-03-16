import { createClient } from "@/lib/supabase/server";
import type { UserProfileDTO, UpdateProfileDTO } from "@/lib/dtos/user.dto";

export const profileDAL = {
  async getById(userId: string): Promise<UserProfileDTO | null> {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, created_at")
      .eq("id", userId)
      .single();

    if (error || !profile) return null;

    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser?.user?.email ?? "";

    return {
      id: profile.id,
      email,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      role: (profile.role as "user" | "admin") ?? "user",
      createdAt: new Date(profile.created_at),
    };
  },

  async update(userId: string, data: UpdateProfileDTO): Promise<void> {
    const supabase = await createClient();
    const updateData: Record<string, unknown> = {};
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) throw error;
  },
};
