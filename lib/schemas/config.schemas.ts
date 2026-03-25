import { z } from "zod";

export const promptModelConfigSchema = z.object({
  temperature: z.number().min(0).max(2),
  model: z.string(),
  /** 中文文献裁判专用（如 `openai/gpt-4o-mini:online`）；仅 `reference_verification` 使用 */
  model_zh: z.string().optional(),
});

export const promptItemSchema = z.object({
  description: z.string(),
  version: z.string(),
  variables: z.array(z.string()),
  templates: z.record(z.string(), z.string()),
  model_config: promptModelConfigSchema.optional(),
  /** 参考文献批量核查时每批条数（仅 `reference_verification` 使用；缺省由编排层回退为 10） */
  verify_batch_size: z.number().int().min(1).max(100).optional(),
});

export const promptsSchema = z.record(z.string(), promptItemSchema);

export const billingPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameZh: z.string(),
  credits: z.number(),
  price: z.number(),
  original_price: z.number(),
  tag: z.string().nullable(),
});

export const consumptionRuleSchema = z.object({
  max_pages: z.number(),
  cost: z.number(),
});

export const billingSchema = z.object({
  version: z.string().optional(),
  currency: z.string().optional(),
  packages: z.array(billingPackageSchema),
  consumption_rules: z.array(consumptionRuleSchema),
  max_allowed_pages: z.number(),
});

export const systemSchema = z.record(z.string(), z.boolean());

export type PromptItem = z.infer<typeof promptItemSchema>;
export type PromptsConfig = z.infer<typeof promptsSchema>;
export type BillingConfig = z.infer<typeof billingSchema>;
export type SystemConfig = z.infer<typeof systemSchema>;
