import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile.actions";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const profile = await getProfile();
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("welcome")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
        {profile?.fullName || data?.user?.email || tCommon("user")}
      </p>
    </div>
  );
}
