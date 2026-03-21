import { createClient } from "@/lib/supabase/server";
import { getWalletBalance } from "@/lib/actions/billing.actions";
import { reviewService } from "@/lib/services/review.service";
import type { ReviewRow } from "@/lib/types/review";
import { ReviewWorkbench } from "../_components/ReviewWorkbench";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const balance = await getWalletBalance();

  let initialReviews: ReviewRow[] = [];
  if (data.user) {
    try {
      initialReviews = await reviewService.listReviewsForUser(data.user.id);
    } catch (e) {
      console.error("[DashboardPage] review list", e);
    }
  }

  return <ReviewWorkbench balance={balance} initialReviews={initialReviews} />;
}
