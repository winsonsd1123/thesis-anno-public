"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { AdminUserListItemDTO } from "@/lib/dtos/user-admin.dto";
import type { UserListQueryUi } from "@/lib/services/user.admin.service";

function formatDt(d: Date | string | null | undefined, intlLocale: string) {
  if (d == null) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(intlLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  items: AdminUserListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
  ui: UserListQueryUi;
  emailFilterNote: boolean;
  usedFallbackListing: boolean;
};

export default function UsersTableClient({
  items,
  page,
  totalPages,
  total,
  ui,
  emailFilterNote,
  usedFallbackListing,
}: Props) {
  const t = useTranslations("admin.users");
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-US" : "zh-CN";

  const q = new URLSearchParams();
  if (ui.email) q.set("email", ui.email);

  const hrefPage = (p: number) => {
    q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/users?${s}` : `/admin/users?page=${p}`;
  };

  return (
    <div>
      {usedFallbackListing && (
        <p style={{ fontSize: 13, color: "var(--warning, #d97706)", marginBottom: 12 }}>{t("fallbackListingHint")}</p>
      )}
      {emailFilterNote && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{t("emailFilterHintFallback")}</p>
      )}

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colEmail")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colName")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colRole")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colDisabled")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colLastSignIn")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colCreated")}</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  {t("empty")}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", wordBreak: "break-all" }}>{row.email || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{row.fullName ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {row.role === "admin" ? t("roleAdmin") : t("roleUser")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {row.isDisabled ? t("disabledYes") : t("disabledNo")}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {formatDt(row.lastSignInAt, intlLocale)}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {formatDt(row.authCreatedAt, intlLocale)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Link
                      href={`/admin/users/${row.id}`}
                      style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}
                    >
                      {t("btnDetail")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {t("pageInfo", { page, totalPages, total })}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {page > 1 ? (
            <Link
              href={hrefPage(page - 1)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 14,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              {t("pagePrev")}
            </Link>
          ) : (
            <span style={{ padding: "8px 14px", fontSize: 14, color: "var(--text-muted)" }}>{t("pagePrev")}</span>
          )}
          {page < totalPages ? (
            <Link
              href={hrefPage(page + 1)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 14,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              {t("pageNext")}
            </Link>
          ) : (
            <span style={{ padding: "8px 14px", fontSize: 14, color: "var(--text-muted)" }}>{t("pageNext")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
