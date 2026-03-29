import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function AdminConfigPage() {
  const t = await getTranslations("admin.config");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
        {t("subtitle")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <Link
          href="/admin/config/prompts"
          style={{
            padding: 24,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("prompts")}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Prompt 模板、多语言、模型参数
          </div>
        </Link>
        <Link
          href="/admin/config/pricing"
          style={{
            padding: 24,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("pricing")}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            套餐价格、消耗规则
          </div>
        </Link>
        <Link
          href="/admin/config/system"
          style={{
            padding: 24,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("system")}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Feature Flags 开关
          </div>
        </Link>
        <Link
          href="/admin/config/edu-grant"
          style={{
            padding: 24,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("eduGrant")}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{t("eduGrantDesc")}</div>
        </Link>
      </div>
    </div>
  );
}
