import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/utils/admin";
import { userInboxAdminService } from "@/lib/services/user-inbox.admin.service";
import { InboxFilterSection } from "./InboxFilterSection";
import { InboxTableSection } from "./InboxTableSection";

export default async function AdminInboxMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; email?: string; read?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.inbox");
  const sp = await searchParams;
  const { rows, ui, truncated } = await userInboxAdminService.listForAdmin(sp);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            {t("title")}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/messages/compose"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--brand)",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          {t("composeLink")}
        </Link>
      </div>

      <InboxFilterSection ui={ui} />
      <InboxTableSection rows={rows} />

      {truncated && (
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>{t("listTruncated")}</p>
      )}
    </div>
  );
}
