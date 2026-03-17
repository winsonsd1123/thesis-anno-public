import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfigService } from "@/lib/services/config.service";
import { promptsSchema } from "@/lib/schemas/config.schemas";
import type { PromptItem } from "@/lib/schemas/config.schemas";
import { PromptEditForm } from "./PromptEditForm";

export default async function PromptEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const t = await getTranslations("admin.prompts");

  const prompts = await ConfigService.get("prompts", promptsSchema);
  const item = prompts[key] as PromptItem | undefined;

  if (!item) {
    notFound();
  }

  const initialData = {
    key,
    description: item.description,
    version: item.version,
    templates: { ...item.templates },
    model_config: item.model_config ?? { temperature: 0.3, model: "gemini-1.5-pro" },
    allPrompts: { ...prompts },
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/config/prompts"
          style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← {t("backToList")}
        </Link>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {t("edit")}: {key}
      </h1>

      <PromptEditForm initialData={initialData} />
    </div>
  );
}
