import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "./SignOutButton";
import { LocaleSwitcher } from "@/app/components/LocaleSwitcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/login");

  const t = await getTranslations("dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-subtle)",
      }}
    >
      <header
        style={{
          height: 56,
          padding: "0 24px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            href="/dashboard"
            style={{
              fontFamily: "Sora, sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            ThesisAI
          </Link>
          <nav style={{ display: "flex", gap: 16 }}>
            <Link
              href="/dashboard"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("home")}
            </Link>
            <Link
              href="/dashboard/billing"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("billing")}
            </Link>
            <Link
              href="/dashboard/settings"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("settings")}
            </Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LocaleSwitcher />
          <Link
            href="/dashboard/settings"
            style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
          >
            {data.user.email}
          </Link>
          <Link href="/" style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}>
            {t("backToHome")}
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
