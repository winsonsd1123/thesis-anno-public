import type { UserInboxAdminListFilters, UserInboxAdminRow } from "@/lib/dal/user-inbox.admin.dal";
import {
  userInboxAdminDAL,
  USER_INBOX_ADMIN_LIST_LIMIT,
} from "@/lib/dal/user-inbox.admin.dal";
import { parseHistoryOpenedRangeIso } from "@/lib/services/edu-credit-grant.service";

export type AdminInboxListQueryUi = {
  from: string;
  to: string;
  email: string;
  read: UserInboxAdminListFilters["readMode"];
};

function parseReadMode(raw: string | undefined): UserInboxAdminListFilters["readMode"] {
  if (raw === "read" || raw === "unread") return raw;
  return "all";
}

/**
 * 解析管理端站内信列表 URL 查询参数（GET /admin/messages?...）。
 */
export function parseAdminInboxListQuery(sp: {
  from?: string;
  to?: string;
  email?: string;
  read?: string;
}): { filters: UserInboxAdminListFilters; ui: AdminInboxListQueryUi } {
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const email = (sp.email ?? "").trim();
  const readMode = parseReadMode(sp.read);

  const range = parseHistoryOpenedRangeIso(
    from.length > 0 ? from : null,
    to.length > 0 ? to : null
  );

  return {
    filters: {
      readMode,
      createdAfter: range.openedAfter,
      createdBefore: range.openedBefore,
      emailSubstr: email.length > 0 ? email : undefined,
    },
    ui: { from, to, email, read: readMode },
  };
}

export const userInboxAdminService = {
  parseAdminInboxListQuery,

  async getByIdForAdmin(messageId: string): Promise<UserInboxAdminRow | null> {
    return userInboxAdminDAL.getMessageById(messageId);
  },

  async listForAdmin(sp: {
    from?: string;
    to?: string;
    email?: string;
    read?: string;
  }): Promise<{ rows: UserInboxAdminRow[]; ui: AdminInboxListQueryUi; truncated: boolean }> {
    const { filters, ui } = parseAdminInboxListQuery(sp);
    const rows = await userInboxAdminDAL.listMessagesFiltered(filters);
    const truncated = rows.length >= USER_INBOX_ADMIN_LIST_LIMIT;
    return { rows, ui, truncated };
  },

  /**
   * 发信：按邮箱解析用户，规范化 snapshot 邮箱；未注册则抛错。
   */
  async sendFromAdmin(
    adminUserId: string,
    input: { recipientEmail: string; senderDisplayName: string; body: string }
  ): Promise<{ id: string }> {
    const rawEmail = input.recipientEmail.trim();
    const normalizedSnapshot = rawEmail.toLowerCase();

    const recipientUserId = await userInboxAdminDAL.lookupUserIdByEmail(rawEmail);
    if (!recipientUserId) {
      throw new Error("该邮箱未注册");
    }

    const id = await userInboxAdminDAL.insertMessage({
      recipientUserId,
      recipientEmailSnapshot: normalizedSnapshot,
      senderDisplayName: input.senderDisplayName.trim(),
      body: input.body,
      createdByAdminId: adminUserId,
    });

    return { id };
  },
};
