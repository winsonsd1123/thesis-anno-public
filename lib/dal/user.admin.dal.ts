import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUserListItemDTO } from "@/lib/dtos/user-admin.dto";

export const USER_ADMIN_PAGE_SIZE = 50;

/** ilike 通配符转义，避免用户输入 % _ 破坏匹配 */
function sanitizeEmailSubstr(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

type ViewRow = {
  id: string;
  email: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_disabled: boolean | null;
  profile_created_at: string | null;
};

function dtoFromViewRow(row: ViewRow): AdminUserListItemDTO {
  return {
    id: row.id,
    email: row.email ?? "",
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: mapRole(row.role),
    isDisabled: row.is_disabled === true,
    lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at) : null,
    authCreatedAt: row.auth_created_at ? new Date(row.auth_created_at) : null,
    profileCreatedAt: row.profile_created_at ? new Date(row.profile_created_at) : null,
  };
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_disabled: boolean | null;
  created_at: string | null;
};

function mapRole(r: string | null | undefined): "user" | "admin" {
  return r === "admin" ? "admin" : "user";
}

function toDto(
  authUser: {
    id: string;
    email?: string;
    last_sign_in_at?: string | null;
    created_at?: string;
  },
  profile: ProfileRow | undefined
): AdminUserListItemDTO {
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: mapRole(profile?.role),
    isDisabled: profile?.is_disabled === true,
    lastSignInAt: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null,
    authCreatedAt: authUser.created_at ? new Date(authUser.created_at) : null,
    profileCreatedAt: profile?.created_at ? new Date(profile.created_at) : null,
  };
}

async function listUsersFromView(
  supabase: ReturnType<typeof createAdminClient>,
  page: number,
  emailSubstr?: string
): Promise<{ items: AdminUserListItemDTO[]; total: number } | null> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * USER_ADMIN_PAGE_SIZE;
  const to = from + USER_ADMIN_PAGE_SIZE - 1;

  let q = supabase
    .from("admin_user_directory")
    .select(
      "id, email, last_sign_in_at, auth_created_at, full_name, avatar_url, role, is_disabled, profile_created_at",
      { count: "exact" }
    )
    .order("profile_created_at", { ascending: false })
    .range(from, to);

  const part = emailSubstr ? sanitizeEmailSubstr(emailSubstr) : "";
  if (part.length > 0) {
    q = q.ilike("email", `%${part}%`);
  }

  const { data, error, count } = await q;

  if (error) {
    const msg = error.message ?? "";
    const permissionDenied = /permission denied|42501|PGRST301/i.test(msg) || error.code === "42501";
    if (permissionDenied) {
      throw new Error(`USER_ADMIN_VIEW: ${error.message}`);
    }
    const missing =
      error.code === "PGRST116" ||
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      /relation|does not exist|schema cache|could not find.*admin_user_directory/i.test(msg);
    if (missing) return null;
    throw new Error(`USER_ADMIN_VIEW: ${error.message}`);
  }

  const rows = (data ?? []) as ViewRow[];
  const total = typeof count === "number" ? count : rows.length;
  return { items: rows.map(dtoFromViewRow), total };
}

/**
 * 当 admin_user_directory 视图未部署或 auth.admin.listUsers 不可用时：
 * 按 profiles 分页并对每行调用 getUserById（避免 listUsers）。
 */
async function listUsersFromProfilesPlusAuth(
  page: number,
  emailSubstr?: string
): Promise<{ items: AdminUserListItemDTO[]; total: number }> {
  const supabase = createAdminClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * USER_ADMIN_PAGE_SIZE;
  const to = from + USER_ADMIN_PAGE_SIZE - 1;

  const { data: profiles, error: pErr, count } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, is_disabled, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (pErr) {
    throw new Error(`USER_ADMIN_PROFILES: ${pErr.message}`);
  }

  const plist = (profiles ?? []) as ProfileRow[];
  const total = typeof count === "number" ? count : plist.length;

  const authPairs = await Promise.all(
    plist.map(async (p) => {
      const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(p.id);
      if (authErr || !authData?.user) {
        return { profile: p, authUser: null };
      }
      return { profile: p, authUser: authData.user };
    })
  );

  let items = authPairs.map(({ profile: p, authUser: u }) =>
    u
      ? toDto(u, p)
      : toDto({ id: p.id, email: "", last_sign_in_at: null, created_at: undefined }, p)
  );

  const part = emailSubstr ? sanitizeEmailSubstr(emailSubstr).toLowerCase() : "";
  if (part.length > 0) {
    items = items.filter((row) => row.email.toLowerCase().includes(part));
  }

  return { items, total };
}

export const userAdminDAL = {
  async listUsersPage(
    page: number,
    emailSubstr?: string
  ): Promise<{
    items: AdminUserListItemDTO[];
    total: number;
    /** 未部署 admin_user_directory 视图时为 true，列表走 profiles + getUserById */
    usedFallbackListing: boolean;
  }> {
    const supabase = createAdminClient();

    const fromView = await listUsersFromView(supabase, page, emailSubstr);
    if (fromView) {
      return { ...fromView, usedFallbackListing: false };
    }

    const fb = await listUsersFromProfilesPlusAuth(page, emailSubstr);
    return { ...fb, usedFallbackListing: true };
  },

  async getUserById(userId: string): Promise<AdminUserListItemDTO | null> {
    const supabase = createAdminClient();
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (authErr || !authData?.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, is_disabled, created_at")
      .eq("id", userId)
      .maybeSingle();

    return toDto(authData.user, profile as ProfileRow | undefined);
  },

  async updateProfile(
    userId: string,
    patch: { fullName?: string | null; role?: "user" | "admin"; isDisabled?: boolean }
  ): Promise<void> {
    const supabase = createAdminClient();
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.isDisabled !== undefined) row.is_disabled = patch.isDisabled;

    if (Object.keys(row).length === 0) return;

    const { error } = await supabase.from("profiles").update(row).eq("id", userId);
    if (error) throw new Error(`USER_ADMIN_UPDATE_PROFILE: ${error.message}`);
  },

  async createUserWithPassword(email: string, password: string): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "USER_ADMIN_CREATE_FAILED");
    }
    return data.user.id;
  },

  async deleteAuthUser(userId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(`USER_ADMIN_DELETE: ${error.message}`);
  },

  /** 当前处于启用状态的管理员数量（role=admin 且未禁用）。 */
  async countActiveAdmins(): Promise<number> {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_disabled", false);

    if (error) throw new Error(`USER_ADMIN_COUNT_ADMINS: ${error.message}`);
    return count ?? 0;
  },
};
