import type { SupabaseClient } from "@supabase/supabase-js";
import { supportTicketUserDAL } from "@/lib/dal/support-ticket.dal";
import type { ReviewRow } from "@/lib/types/review";

const SUBJECT_MAX_LEN = 200;

export type CreateUserSupportTicketError =
  | "SUBJECT_REQUIRED"
  | "SUBJECT_TOO_LONG"
  | "REVIEW_NOT_FOUND"
  | "TICKET_INSERT_FAILED";

export type CreateUserSupportTicketResult =
  | { ok: true }
  | { ok: false; error: CreateUserSupportTicketError };

function buildTicketDescription(review: ReviewRow): string {
  const lines: string[] = [
    "[Review snapshot — attached automatically]",
    `id: ${review.id}`,
    `file_name: ${review.file_name ?? "—"}`,
    `status: ${review.status}`,
    `domain: ${review.domain ?? "—"}`,
    `word_count: ${review.word_count ?? "—"}`,
    `cost: ${review.cost}`,
    `refunded_amount: ${review.refunded_amount ?? 0}`,
    `error_message: ${review.error_message ?? "—"}`,
    `created_at: ${review.created_at}`,
    `updated_at: ${review.updated_at}`,
    `completed_at: ${review.completed_at ?? "—"}`,
    `trigger_run_id: ${review.trigger_run_id ?? "—"}`,
  ];
  if (review.plan_options && typeof review.plan_options === "object") {
    lines.push(`plan_options: ${JSON.stringify(review.plan_options)}`);
  }
  if (review.stages?.length) {
    lines.push("stages:");
    for (const s of review.stages) {
      lines.push(`  - ${s.agent}: ${s.status}`);
    }
  } else {
    lines.push("stages: —");
  }
  return lines.join("\n");
}

export const supportTicketService = {
  async createTicketForReview(
    supabase: SupabaseClient,
    params: {
      userId: string;
      email: string | null;
      reviewId: number;
      subject: string;
    }
  ): Promise<CreateUserSupportTicketResult> {
    const subject = params.subject.trim();
    if (!subject) return { ok: false, error: "SUBJECT_REQUIRED" };
    if (subject.length > SUBJECT_MAX_LEN) return { ok: false, error: "SUBJECT_TOO_LONG" };

    let review: ReviewRow | null;
    try {
      review = await supportTicketUserDAL.fetchReviewForUser(supabase, params.reviewId, params.userId);
    } catch (e) {
      console.error("[supportTicketService] fetchReview", e);
      return { ok: false, error: "TICKET_INSERT_FAILED" };
    }
    if (!review) return { ok: false, error: "REVIEW_NOT_FOUND" };

    const description = buildTicketDescription(review);

    try {
      await supportTicketUserDAL.insertTicket(supabase, {
        user_id: params.userId,
        review_id: params.reviewId,
        category: "general_inquiry",
        subject,
        description,
        status: "open",
        priority: "medium",
        reporter_email: params.email,
      });
    } catch (e) {
      console.error("[supportTicketService] insertTicket", e);
      return { ok: false, error: "TICKET_INSERT_FAILED" };
    }

    return { ok: true };
  },

  async reviewHasBlockingTicket(
    supabase: SupabaseClient,
    reviewId: number,
    userId: string
  ): Promise<boolean> {
    return supportTicketUserDAL.hasBlockingTicketForReview(supabase, reviewId, userId);
  },
};
