import { getTranslations } from "next-intl/server";
import { ConfigService } from "@/lib/services/config.service";
import { billingSchema } from "@/lib/schemas/config.schemas";
import { PricingConfigForm } from "./PricingConfigForm";

export default async function PricingConfigPage() {
  const t = await getTranslations("admin.pricing");
  const config = await ConfigService.get("billing", billingSchema);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <PricingConfigForm initialConfig={config} />
    </div>
  );
}
