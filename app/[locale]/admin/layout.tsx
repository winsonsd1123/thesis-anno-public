import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { LocaleSwitcher } from "@/app/components/LocaleSwitcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const t = await getTranslations("admin");

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
            href="/admin/config"
            style={{
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            {t("title")}
          </Link>
          <nav style={{ display: "flex", gap: 16 }}>
            <Link
              href="/admin/config"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("config.title")}
            </Link>
            <Link
              href="/admin/config/prompts"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("config.prompts")}
            </Link>
            <Link
              href="/admin/config/pricing"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("config.pricing")}
            </Link>
            <Link
              href="/admin/config/system"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("config.system")}
            </Link>
            <Link
              href="/admin/tickets"
              style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {t("tickets.navLabel")}
            </Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LocaleSwitcher />
          <Link
            href="/dashboard"
            style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none" }}
          >
            {t("backToDashboard")}
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
