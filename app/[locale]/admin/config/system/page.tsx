import { getTranslations } from "next-intl/server";
import { ConfigService } from "@/lib/services/config.service";
import { systemSchema } from "@/lib/schemas/config.schemas";
import { SystemConfigForm } from "./SystemConfigForm";

export default async function SystemConfigPage() {
  const t = await getTranslations("admin.system");
  const config = await ConfigService.get("system", systemSchema);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <SystemConfigForm initialConfig={config} />
    </div>
  );
}
