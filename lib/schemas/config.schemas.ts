import { z } from "zod";

export const promptModelConfigSchema = z.object({
  temperature: z.number().min(0).max(2),
  model: z.string(),
});

export const promptItemSchema = z.object({
  description: z.string(),
  version: z.string(),
  variables: z.array(z.string()),
  templates: z.record(z.string(), z.string()),
  model_config: promptModelConfigSchema.optional(),
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
