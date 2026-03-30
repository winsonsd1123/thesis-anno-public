"use server";

import { createClient } from "@/lib/supabase/server";
import { supportTicketService } from "@/lib/services/support-ticket.service";

export type CreateUserSupportTicketForReviewResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "NOT_AUTHENTICATED"
        | "SUBJECT_REQUIRED"
        | "SUBJECT_TOO_LONG"
        | "REVIEW_NOT_FOUND"
        | "TICKET_INSERT_FAILED";
    };

export async function createUserSupportTicketForReview(
  reviewId: number,
  subject: string
): Promise<CreateUserSupportTicketForReviewResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "NOT_AUTHENTICATED" };

  const result = await supportTicketService.createTicketForReview(supabase, {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    reviewId,
    subject: typeof subject === "string" ? subject : "",
  });

  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}
