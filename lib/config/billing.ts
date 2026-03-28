import { ConfigService } from "@/lib/services/config.service";
import { billingSchema } from "@/lib/schemas/config.schemas";
import type { ModuleCosts, ModuleConsumptionRule } from "@/lib/schemas/config.schemas";
import type { ReviewPlanOptions } from "@/lib/types/review";

export type BillingPackage = {
  id: string;
  name: string;
  nameZh: string;
  credits: number;
  price: number;
  original_price: number;
  tag: string | null;
};

export type { ModuleCosts, ModuleConsumptionRule };

/**
 * 各模块单价快照：仅含已选中维度 + total。
 * 写入 reviews.cost_breakdown，用于局部退款时按快照原路退回。
 */
export type CostBreakdownSnapshot = Partial<Record<"logic" | "format" | "aitrace" | "reference", number>> & {
  total: number;
};

export async function getBillingConfig() {
  return ConfigService.get("billing", billingSchema);
}

export async function getPackages(): Promise<BillingPackage[]> {
  const config = await getBillingConfig();
  return config.packages as BillingPackage[];
}

export async function getPackageById(id: string): Promise<BillingPackage | null> {
  const packages = await getPackages();
  return packages.find((p) => p.id === id) ?? null;
}

export async function getModuleConsumptionRules(): Promise<ModuleConsumptionRule[]> {
  const config = await getBillingConfig();
  return [...config.module_consumption_rules].sort((a, b) => a.max_words - b.max_words);
}

export async function getMaxAllowedWords(): Promise<number> {
  const config = await getBillingConfig();
  return config.max_allowed_words;
}

/**
 * 按 planOptions 中已启用的维度累加积分单价。
 */
export function sumModuleCostsForPlan(costs: ModuleCosts, planOptions: ReviewPlanOptions): number {
  const keys = ["logic", "format", "aitrace", "reference"] as const;
  return keys.reduce((sum, k) => (planOptions[k] ? sum + costs[k] : sum), 0);
}

/**
 * 按字数阶梯 + planOptions 计算扣费总额与各模块快照。
 * 返回 null 表示字数超出范围或找不到匹配阶梯。
 */
export async function calculateReviewCost(
  wordCount: number,
  planOptions: ReviewPlanOptions
): Promise<{ totalCost: number; breakdown: CostBreakdownSnapshot } | null> {
  const config = await getBillingConfig();
  if (wordCount <= 0 || wordCount > config.max_allowed_words) {
    return null;
  }
  const rules = [...config.module_consumption_rules].sort((a, b) => a.max_words - b.max_words);
  for (const rule of rules) {
    if (wordCount <= rule.max_words) {
      const totalCost = sumModuleCostsForPlan(rule.costs, planOptions);
      const breakdown: CostBreakdownSnapshot = { total: totalCost };
      const keys = ["logic", "format", "aitrace", "reference"] as const;
      for (const k of keys) {
        if (planOptions[k]) {
          breakdown[k] = rule.costs[k];
        }
      }
      return { totalCost, breakdown };
    }
  }
  return null;
}
