import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/utils/admin";
import { userInboxAdminService } from "@/lib/services/user-inbox.admin.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AdminInboxMessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("admin.inbox");

  const row = await userInboxAdminService.getByIdForAdmin(id);
  if (!row) notFound();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/admin/messages"
        style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", marginBottom: 20, display: "inline-block" }}
      >
        ← {t("backToList")}
      </Link>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 12,
        }}
      >
        {t("detailTitle")}
      </h1>

      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
        {t("detailMeta", { email: row.recipient_email_snapshot, time: formatDate(row.created_at) })}
      </p>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
        <strong style={{ color: "var(--text-primary)" }}>{t("colSender")}:</strong>{" "}
        {row.sender_display_name}
      </p>

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        {row.read_at
          ? t("detailRead", { time: formatDate(row.read_at) })
          : t("detailUnread")}
      </p>

      <div
        style={{
          padding: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
        }}
      >
        {row.body}
      </div>
    </div>
  );
}
