import { createAdminClient } from "@/lib/supabase/admin";

export type UserInboxAdminRow = {
  id: string;
  recipient_user_id: string;
  recipient_email_snapshot: string;
  sender_display_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
  created_by_admin_id: string | null;
};

export type UserInboxAdminListFilters = {
  readMode: "all" | "read" | "unread";
  createdAfter?: string;
  createdBefore?: string;
  emailSubstr?: string;
};

const LIST_LIMIT = 500;

function sanitizeEmailSubstr(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

export const userInboxAdminDAL = {
  async lookupUserIdByEmail(email: string): Promise<string | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("admin_lookup_user_id_by_email", {
      candidate_email: email.trim(),
    });
    if (error) throw new Error(`USER_INBOX_LOOKUP: ${error.message}`);
    if (data == null || data === "") return null;
    return String(data);
  },

  async insertMessage(input: {
    recipientUserId: string;
    recipientEmailSnapshot: string;
    senderDisplayName: string;
    body: string;
    createdByAdminId: string;
  }): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_inbox_messages")
      .insert({
        recipient_user_id: input.recipientUserId,
        recipient_email_snapshot: input.recipientEmailSnapshot,
        sender_display_name: input.senderDisplayName,
        body: input.body,
        created_by_admin_id: input.createdByAdminId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`USER_INBOX_INSERT: ${error.message}`);
    return (data as { id: string }).id;
  },

  async getMessageById(messageId: string): Promise<UserInboxAdminRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_inbox_messages")
      .select(
        "id, recipient_user_id, recipient_email_snapshot, sender_display_name, body, read_at, created_at, created_by_admin_id"
      )
      .eq("id", messageId)
      .maybeSingle();

    if (error) throw new Error(`USER_INBOX_ADMIN_GET: ${error.message}`);
    return data as UserInboxAdminRow | null;
  },

  async listMessagesFiltered(filters: UserInboxAdminListFilters): Promise<UserInboxAdminRow[]> {
    const supabase = createAdminClient();
    let q = supabase
      .from("user_inbox_messages")
      .select(
        "id, recipient_user_id, recipient_email_snapshot, sender_display_name, body, read_at, created_at, created_by_admin_id"
      );

    if (filters.readMode === "read") {
      q = q.not("read_at", "is", null);
    } else if (filters.readMode === "unread") {
      q = q.is("read_at", null);
    }

    if (filters.createdAfter) {
      q = q.gte("created_at", filters.createdAfter);
    }
    if (filters.createdBefore) {
      q = q.lte("created_at", filters.createdBefore);
    }

    const emailPart = filters.emailSubstr ? sanitizeEmailSubstr(filters.emailSubstr) : "";
    if (emailPart.length > 0) {
      q = q.ilike("recipient_email_snapshot", `%${emailPart}%`);
    }

    const { data, error } = await q.order("created_at", { ascending: false }).limit(LIST_LIMIT);

    if (error) throw new Error(`USER_INBOX_ADMIN_LIST: ${error.message}`);
    return (data ?? []) as UserInboxAdminRow[];
  },
};

export const USER_INBOX_ADMIN_LIST_LIMIT = LIST_LIMIT;
