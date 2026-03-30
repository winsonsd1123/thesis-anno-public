import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { UserInboxAdminRow } from "@/lib/dal/user-inbox.admin.dal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewBody(body: string, max = 72) {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type Props = {
  rows: UserInboxAdminRow[];
};

export async function InboxTableSection({ rows }: Props) {
  const t = await getTranslations("admin.inbox");

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("empty")}</p>
    );
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colEmail")}
            </th>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colSender")}
            </th>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colCreatedAt")}
            </th>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colRead")}
            </th>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colPreview")}
            </th>
            <th style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("colOpen")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "14px 16px", fontSize: 14 }}>{row.recipient_email_snapshot}</td>
              <td style={{ padding: "14px 16px", fontSize: 14 }}>{row.sender_display_name}</td>
              <td style={{ padding: "14px 16px", fontSize: 14, color: "var(--text-secondary)" }}>
                {formatDate(row.created_at)}
              </td>
              <td style={{ padding: "14px 16px", fontSize: 14 }}>
                {row.read_at ? t("readYes") : t("readNo")}
              </td>
              <td
                style={{
                  padding: "14px 16px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  maxWidth: 280,
                }}
              >
                {previewBody(row.body)}
              </td>
              <td style={{ padding: "14px 16px", fontSize: 14 }}>
                <Link
                  href={`/admin/messages/${row.id}`}
                  style={{ color: "var(--brand)", textDecoration: "none" }}
                >
                  {t("openDetail")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
