import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { reviewAdminService } from "@/lib/services/review.admin.service";
import ReviewsTableClient from "./ReviewsTableClient";
import { ReviewsFilterSection } from "./ReviewsFilterSection";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.reviews");
  const sp = await searchParams;
  const { rows, ui, truncated } = await reviewAdminService.listForAdmin(sp);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          {t("title")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("subtitle")}</p>
      </div>

      <ReviewsFilterSection ui={ui} />

      <ReviewsTableClient rows={rows} />

      {truncated && <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>{t("listTruncated")}</p>}
    </div>
  );
}
