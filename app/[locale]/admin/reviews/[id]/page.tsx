import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/utils/admin";
import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { AdminReviewDetailClient } from "./AdminReviewDetailClient";

export default async function AdminReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const review = await reviewAdminDAL.getReviewById(id);
  if (!review) notFound();

  const user_email = await reviewAdminDAL.getUserEmailForAdmin(review.user_id);

  return (
    <AdminReviewDetailClient
      review={{
        id: review.id,
        file_name: review.file_name,
        status: review.status,
        completed_at: review.completed_at,
        updated_at: review.updated_at,
        user_email,
        result: review.result,
      }}
    />
  );
}
