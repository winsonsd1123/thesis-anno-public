import { ConfigService } from "@/lib/services/config.service";
import { promptsSchema } from "@/lib/schemas/config.schemas";

const SUPPORTED_LOCALES = ["zh", "en"] as const;
const FALLBACK_LOCALE = "en";

/**
 * 从模板内容中提取 {{var}} 变量
 */
function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * 简单 {{var}} 替换
 */
function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export const promptManager = {
  async getTemplate(
    key: string,
    locale: string,
    variables: Record<string, string>
  ): Promise<string> {
    const prompts = await ConfigService.get("prompts", promptsSchema);
    const item = prompts[key];

    if (!item) {
      throw new Error(`PromptManager: Unknown prompt key "${key}"`);
    }

    const templates = item.templates;
    const resolvedLocale =
      SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number]) &&
      templates[locale]
        ? locale
        : FALLBACK_LOCALE;

    const template = templates[resolvedLocale] ?? templates[FALLBACK_LOCALE];

    if (!template) {
      throw new Error(`PromptManager: No template for "${key}" (locale: ${locale})`);
    }

    return interpolate(template, variables);
  },

  async getModelConfig(key: string): Promise<{ temperature: number; model: string } | null> {
    const prompts = await ConfigService.get("prompts", promptsSchema);
    const item = prompts[key];
    return item?.model_config ?? null;
  },

  extractVariables,
};
