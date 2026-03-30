import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { userInboxService } from "@/lib/services/user-inbox.service";
import { InboxMarkReadOnOpen } from "../InboxMarkReadOnOpen";

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

export default async function DashboardMessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/login");

  const { id } = await params;
  const t = await getTranslations("dashboard.messages");

  const row = await userInboxService.getByIdForUser(id, data.user.id);
  if (!row) notFound();

  return (
    <div
      style={{
        position: "relative",
        minHeight: "calc(100vh - 56px)",
        padding: "32px 24px 48px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <InboxMarkReadOnOpen messageId={row.id} />

      <Link
        href="/dashboard/messages"
        style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", marginBottom: 20, display: "inline-block" }}
      >
        ← {t("back")}
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

      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
        <strong style={{ color: "var(--text-primary)" }}>{t("colSender")}:</strong>{" "}
        {row.sender_display_name}
      </p>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
        {t("sentAt")}: {formatDate(row.created_at)}
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
