import { createClient } from "@/lib/supabase/server";

export type UserInboxMessageRow = {
  id: string;
  recipient_user_id: string;
  recipient_email_snapshot: string;
  sender_display_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
  created_by_admin_id: string | null;
};

export const userInboxDAL = {
  async listForUser(userId: string): Promise<UserInboxMessageRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_inbox_messages")
      .select(
        "id, recipient_user_id, recipient_email_snapshot, sender_display_name, body, read_at, created_at, created_by_admin_id"
      )
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`USER_INBOX_LIST: ${error.message}`);
    return (data ?? []) as UserInboxMessageRow[];
  },

  async countUnread(userId: string): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("user_inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (error) throw new Error(`USER_INBOX_COUNT: ${error.message}`);
    return count ?? 0;
  },

  async getByIdForUser(messageId: string, userId: string): Promise<UserInboxMessageRow | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_inbox_messages")
      .select(
        "id, recipient_user_id, recipient_email_snapshot, sender_display_name, body, read_at, created_at, created_by_admin_id"
      )
      .eq("id", messageId)
      .eq("recipient_user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`USER_INBOX_GET: ${error.message}`);
    return data as UserInboxMessageRow | null;
  },

  async markRead(messageId: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_inbox_messages")
      .update({ read_at: now })
      .eq("id", messageId)
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (error) throw new Error(`USER_INBOX_MARK_READ: ${error.message}`);
  },
};
