import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { userInboxService } from "@/lib/services/user-inbox.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewBody(body: string, max = 80) {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default async function DashboardMessagesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/login");

  const t = await getTranslations("dashboard.messages");
  const rows = await userInboxService.listForUser(data.user.id);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "calc(100vh - 56px)",
        padding: "32px 24px 48px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
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
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 28 }}>{t("subtitle")}</p>

      {rows.length === 0 ? (
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("empty")}</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {t("colSender")}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {t("colTime")}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {t("colStatus")}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                  {t("colPreview")}
                </th>
                <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>
                    {row.sender_display_name}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14, color: "var(--text-secondary)" }}>
                    {formatDate(row.created_at)}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14 }}>
                    {row.read_at ? t("statusRead") : t("statusUnread")}
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      maxWidth: 320,
                    }}
                  >
                    {previewBody(row.body)}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14 }}>
                    <Link
                      href={`/dashboard/messages/${row.id}`}
                      style={{ color: "var(--brand)", textDecoration: "none" }}
                    >
                      {t("open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
