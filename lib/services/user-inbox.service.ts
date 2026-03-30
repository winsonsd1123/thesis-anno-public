import { userInboxDAL, type UserInboxMessageRow } from "@/lib/dal/user-inbox.dal";

export const userInboxService = {
  async listForUser(userId: string): Promise<UserInboxMessageRow[]> {
    return userInboxDAL.listForUser(userId);
  },

  async countUnread(userId: string): Promise<number> {
    return userInboxDAL.countUnread(userId);
  },

  async getByIdForUser(messageId: string, userId: string): Promise<UserInboxMessageRow | null> {
    return userInboxDAL.getByIdForUser(messageId, userId);
  },

  async markReadIfUnread(messageId: string, userId: string): Promise<void> {
    await userInboxDAL.markRead(messageId, userId);
  },
};
