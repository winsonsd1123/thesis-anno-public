import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import type {
  EduCreditGrantClaimWithEmailRow,
  EduCreditGrantWindowRow,
} from "@/lib/dal/edu-credit-grant.dal";

type Round = EduCreditGrantWindowRow & { claims: EduCreditGrantClaimWithEmailRow[] };

type Props = {
  rounds: Round[];
  total: number;
  page: number;
  pageSize: number;
  histFrom: string;
  histTo: string;
  histEmail: string;
};

function buildQuery(
  p: { histFrom: string; histTo: string; histEmail: string; histPage: number }
): string {
  const q = new URLSearchParams();
  if (p.histFrom) q.set("histFrom", p.histFrom);
  if (p.histTo) q.set("histTo", p.histTo);
  if (p.histEmail) q.set("histEmail", p.histEmail);
  if (p.histPage > 1) q.set("histPage", String(p.histPage));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function EduGrantHistorySection({
  rounds,
  total,
  page,
  pageSize,
  histFrom,
  histTo,
  histEmail,
}: Props) {
  const t = await getTranslations("admin.eduGrant.history");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = { histFrom, histTo, histEmail };

  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
        {t("subtitle")}
      </p>

      <form
        method="get"
        action=""
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 24,
          padding: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <div>
          <label
            htmlFor="histFrom"
            style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}
          >
            {t("filterFrom")}
          </label>
          <input
            id="histFrom"
            name="histFrom"
            type="date"
            defaultValue={histFrom}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <label
            htmlFor="histTo"
            style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}
          >
            {t("filterTo")}
          </label>
          <input
            id="histTo"
            name="histTo"
            type="date"
            defaultValue={histTo}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <label
            htmlFor="histEmail"
            style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}
          >
            {t("filterEmail")}
          </label>
          <input
            id="histEmail"
            name="histEmail"
            type="search"
            placeholder={t("filterEmailPlaceholder")}
            defaultValue={histEmail}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--brand)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {t("search")}
        </button>
      </form>

      {rounds.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("empty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rounds.map((w) => {
            const opened = new Date(w.opened_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const closedLabel = w.closed_at
              ? new Date(w.closed_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : null;
            return (
              <details key={w.id} className="edu-grant-round">
                <summary className="edu-grant-round-summary">
                  <div className="edu-grant-round-summary-main">
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{opened}</span>
                    <span
                      className={
                        w.closed_at
                          ? "admin-pill-badge admin-pill-badge--amber"
                          : "admin-pill-badge admin-pill-badge--emerald"
                      }
                    >
                      {w.closed_at ? t("roundClosed") : t("roundOpen")}
                    </span>
                    <span className="admin-pill-badge admin-pill-badge--slate">
                      {t("roundCountsBadge", { claimed: w.claims.length, max: w.max_claims })}
                    </span>
                    {closedLabel ? (
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                        {t("closedAt", { at: closedLabel })}
                      </span>
                    ) : null}
                  </div>
                  <svg
                    className="edu-grant-round-chevron"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <div className="edu-grant-round-body">
                  {w.claims.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noClaimsInRound")}</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 13,
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                            <th style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>
                              {t("colEmail")}
                            </th>
                            <th style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>
                              {t("colUserId")}
                            </th>
                            <th style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>
                              {t("colCredits")}
                            </th>
                            <th style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>
                              {t("colClaimedAt")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {w.claims.map((c) => (
                            <tr key={c.claim_id} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "8px 6px", wordBreak: "break-all" }}>{c.user_email || "—"}</td>
                              <td style={{ padding: "8px 6px", wordBreak: "break-all", fontFamily: "monospace" }}>
                                {c.user_id}
                              </td>
                              <td style={{ padding: "8px 6px" }}>{c.credits}</td>
                              <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                                {new Date(c.created_at).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <nav
          style={{
            marginTop: 24,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            fontSize: 14,
            color: "var(--text-secondary)",
          }}
        >
          <span>{t("pageStatus", { page, totalPages, total })}</span>
          <div style={{ display: "flex", gap: 12 }}>
            {page > 1 ? (
              <Link
                href={`/admin/config/edu-grant${buildQuery({ ...base, histPage: page - 1 })}`}
                style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}
              >
                {t("prev")}
              </Link>
            ) : (
              <span style={{ opacity: 0.4 }}>{t("prev")}</span>
            )}
            {page < totalPages ? (
              <Link
                href={`/admin/config/edu-grant${buildQuery({ ...base, histPage: page + 1 })}`}
                style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}
              >
                {t("next")}
              </Link>
            ) : (
              <span style={{ opacity: 0.4 }}>{t("next")}</span>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
