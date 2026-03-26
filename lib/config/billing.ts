import { ConfigService } from "@/lib/services/config.service";
import { billingSchema } from "@/lib/schemas/config.schemas";

export type BillingPackage = {
  id: string;
  name: string;
  nameZh: string;
  credits: number;
  price: number;
  original_price: number;
  tag: string | null;
};

export type WordConsumptionRule = {
  max_words: number;
  cost: number;
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

/**
 * 按字数阶梯估算扣点；规则按 max_words 升序，命中第一条 wordCount <= max_words。
 */
export async function estimateCostByWords(wordCount: number): Promise<number | null> {
  const config = await getBillingConfig();
  if (wordCount <= 0 || wordCount > config.max_allowed_words) {
    return null;
  }
  const rules = [...config.word_consumption_rules].sort((a, b) => a.max_words - b.max_words);
  for (const rule of rules) {
    if (wordCount <= rule.max_words) {
      return rule.cost;
    }
  }
  return null;
}

export async function getWordConsumptionRules(): Promise<WordConsumptionRule[]> {
  const config = await getBillingConfig();
  return config.word_consumption_rules as WordConsumptionRule[];
}

export async function getMaxAllowedWords(): Promise<number> {
  const config = await getBillingConfig();
  return config.max_allowed_words;
}
