import type { AdminReviewListRow } from "@/lib/dal/review.admin.dal";
import { reviewAdminDAL, REVIEW_ADMIN_LIST_LIMIT } from "@/lib/dal/review.admin.dal";

export type ReviewListQueryUi = {
  email: string;
};

function parseListQuery(sp: { email?: string }): { filters: { emailSubstr?: string }; ui: ReviewListQueryUi } {
  const email = (sp.email ?? "").trim();
  return {
    filters: email.length > 0 ? { emailSubstr: email } : {},
    ui: { email },
  };
}

export const reviewAdminService = {
  parseListQuery,

  async listForAdmin(sp: { email?: string }): Promise<{
    rows: AdminReviewListRow[];
    ui: ReviewListQueryUi;
    truncated: boolean;
  }> {
    const { filters, ui } = parseListQuery(sp);
    const rows = await reviewAdminDAL.listReviewsForAdmin(filters);
    const truncated = rows.length >= REVIEW_ADMIN_LIST_LIMIT;
    return { rows, ui, truncated };
  },
};
