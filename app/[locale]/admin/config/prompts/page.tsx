import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ConfigService } from "@/lib/services/config.service";
import { promptsSchema } from "@/lib/schemas/config.schemas";

export default async function PromptsListPage() {
  const t = await getTranslations("admin.prompts");
  const prompts = await ConfigService.get("prompts", promptsSchema);

  const keys = Object.keys(prompts);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: 12, textAlign: "left", fontSize: 13, fontWeight: 600 }}>
                {t("key")}
              </th>
              <th style={{ padding: 12, textAlign: "left", fontSize: 13, fontWeight: 600 }}>
                {t("description")}
              </th>
              <th style={{ padding: 12, textAlign: "left", fontSize: 13, fontWeight: 600 }}>
                {t("version")}
              </th>
              <th style={{ padding: 12, textAlign: "right", fontSize: 13, fontWeight: 600 }}>
                {t("edit")}
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const item = prompts[key];
              return (
                <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: 12, fontSize: 14, fontFamily: "monospace" }}>{key}</td>
                  <td style={{ padding: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                    {item.description}
                  </td>
                  <td style={{ padding: 12, fontSize: 14 }}>{item.version}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    <Link
                      href={`/admin/config/prompts/${encodeURIComponent(key)}`}
                      style={{
                        fontSize: 14,
                        color: "var(--brand)",
                        textDecoration: "none",
                      }}
                    >
                      {t("edit")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
