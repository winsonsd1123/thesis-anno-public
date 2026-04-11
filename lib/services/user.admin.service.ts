import {
  userAdminDAL,
  USER_ADMIN_PAGE_SIZE,
} from "@/lib/dal/user.admin.dal";
import type { AdminUserListItemDTO } from "@/lib/dtos/user-admin.dto";

export type UserListQueryUi = {
  page: number;
  email: string;
};

export function parseUserListQuery(sp: { page?: string; email?: string }): {
  page: number;
  emailSubstr?: string;
  ui: UserListQueryUi;
} {
  const raw = (sp.page ?? "1").trim();
  const parsed = parseInt(raw, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const email = (sp.email ?? "").trim();
  return {
    page,
    emailSubstr: email.length > 0 ? email : undefined,
    ui: { page, email },
  };
}

export class UserAdminPolicyError extends Error {
  constructor(
    message: string,
    public readonly code: "LAST_ADMIN" | "SELF_ACTION" | "USER_NOT_FOUND"
  ) {
    super(message);
    this.name = "UserAdminPolicyError";
  }
}

async function assertNotLastActiveAdmin(targetUserId: string): Promise<void> {
  const target = await userAdminDAL.getUserById(targetUserId);
  if (!target) {
    throw new UserAdminPolicyError("User not found", "USER_NOT_FOUND");
  }
  const isActiveAdmin = target.role === "admin" && !target.isDisabled;
  if (!isActiveAdmin) return;

  const count = await userAdminDAL.countActiveAdmins();
  if (count <= 1) {
    throw new UserAdminPolicyError("Cannot remove the last active admin", "LAST_ADMIN");
  }
}

function assertNotSelfAction(
  actorUserId: string,
  targetUserId: string,
  kind: "delete" | "disable" | "demote"
): void {
  if (actorUserId !== targetUserId) return;
  throw new UserAdminPolicyError(
    kind === "delete"
      ? "Cannot delete your own account"
      : kind === "disable"
        ? "Cannot disable your own account"
        : "Cannot demote your own admin role",
    "SELF_ACTION"
  );
}

export const userAdminService = {
  parseUserListQuery,

  async listUsersForAdmin(sp: {
    page?: string;
    email?: string;
  }): Promise<{
    items: AdminUserListItemDTO[];
    page: number;
    total: number;
    totalPages: number;
    ui: UserListQueryUi;
    /** 降级列表且带邮箱条件时：筛选仅作用于当前页 */
    emailFilterNote: boolean;
    usedFallbackListing: boolean;
  }> {
    const { page, emailSubstr, ui } = parseUserListQuery(sp);
    const { items, total, usedFallbackListing } = await userAdminDAL.listUsersPage(page, emailSubstr);

    const totalPages = Math.max(1, Math.ceil(total / USER_ADMIN_PAGE_SIZE));
    return {
      items,
      page,
      total,
      totalPages,
      ui,
      emailFilterNote: !!emailSubstr && usedFallbackListing,
      usedFallbackListing,
    };
  },

  async getUserForAdmin(userId: string): Promise<AdminUserListItemDTO | null> {
    return userAdminDAL.getUserById(userId);
  },

  async createUser(actorUserId: string, email: string, password: string): Promise<string> {
    void actorUserId;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 8) {
      throw new Error("INVALID_INPUT");
    }
    return userAdminDAL.createUserWithPassword(trimmedEmail, password);
  },

  async updateUser(
    actorUserId: string,
    targetUserId: string,
    patch: { fullName?: string | null; role?: "user" | "admin"; isDisabled?: boolean }
  ): Promise<void> {
    const nextRole = patch.role;
    if (nextRole === "user") {
      assertNotSelfAction(actorUserId, targetUserId, "demote");
      await assertNotLastActiveAdmin(targetUserId);
    }
    if (patch.isDisabled === true) {
      assertNotSelfAction(actorUserId, targetUserId, "disable");
      await assertNotLastActiveAdmin(targetUserId);
    }

    await userAdminDAL.updateProfile(targetUserId, {
      fullName: patch.fullName,
      role: patch.role,
      isDisabled: patch.isDisabled,
    });
  },

  async deleteUser(actorUserId: string, targetUserId: string): Promise<void> {
    assertNotSelfAction(actorUserId, targetUserId, "delete");
    await assertNotLastActiveAdmin(targetUserId);
    await userAdminDAL.deleteAuthUser(targetUserId);
  },
};
