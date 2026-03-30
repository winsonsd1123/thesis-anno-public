import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/utils/admin";
import { AdminInboxComposeForm } from "../AdminInboxComposeForm";

export default async function AdminInboxComposePage() {
  await requireAdmin();
  const t = await getTranslations("admin.inbox");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/messages"
          style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", marginBottom: 12, display: "inline-block" }}
        >
          ← {t("backToList")}
        </Link>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {t("composeTitle")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>{t("composeSubtitle")}</p>
      </div>

      <div
        style={{
          padding: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <AdminInboxComposeForm />
      </div>
    </div>
  );
}
