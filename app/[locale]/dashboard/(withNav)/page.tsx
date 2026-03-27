import { createClient } from "@/lib/supabase/server";
import { getWalletBalance } from "@/lib/actions/billing.actions";
import { profileDAL } from "@/lib/dal/profile.dal";
import { reviewService } from "@/lib/services/review.service";
import type { ReviewRow } from "@/lib/types/review";
import { ReviewWorkbench } from "../_components/ReviewWorkbench";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const balance = await getWalletBalance();

  let initialReviews: ReviewRow[] = [];
  let isAdmin = false;
  if (data.user) {
    try {
      initialReviews = await reviewService.listReviewsForUser(data.user.id);
    } catch (e) {
      console.error("[DashboardPage] review list", e);
    }
    try {
      const profile = await profileDAL.getById(data.user.id);
      isAdmin = profile?.role === "admin";
    } catch (e) {
      console.error("[DashboardPage] profile", e);
    }
  }

  return (
    <ReviewWorkbench balance={balance} initialReviews={initialReviews} isAdmin={isAdmin} />
  );
}
