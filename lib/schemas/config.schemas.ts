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

/** 模块消耗明细：各维度独立积分单价（百倍精度） */
export const moduleCostsSchema = z.object({
  logic: z.number().int().nonnegative(),
  format: z.number().int().nonnegative(),
  aitrace: z.number().int().nonnegative(),
  reference: z.number().int().nonnegative(),
}).strict();

/** 字数阶梯：按 max_words 升序排列，取第一个满足 wordCount <= max_words 的规则 */
export const moduleConsumptionRuleSchema = z.object({
  max_words: z.number().int().positive(),
  costs: moduleCostsSchema,
});

export const billingSchema = z.object({
  version: z.string().optional(),
  currency: z.string().optional(),
  packages: z.array(billingPackageSchema),
  module_consumption_rules: z.array(moduleConsumptionRuleSchema),
  max_allowed_words: z.number(),
});

export const systemSchema = z.record(z.string(), z.boolean());

export type PromptItem = z.infer<typeof promptItemSchema>;
export type PromptsConfig = z.infer<typeof promptsSchema>;
export type BillingConfig = z.infer<typeof billingSchema>;
export type ModuleCosts = z.infer<typeof moduleCostsSchema>;
export type ModuleConsumptionRule = z.infer<typeof moduleConsumptionRuleSchema>;
export type SystemConfig = z.infer<typeof systemSchema>;
