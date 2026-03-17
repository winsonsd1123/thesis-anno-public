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

export type ConsumptionRule = {
  max_pages: number;
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

export async function estimateCost(pageCount: number): Promise<number | null> {
  const config = await getBillingConfig();
  if (pageCount <= 0 || pageCount > config.max_allowed_pages) {
    return null;
  }
  const rules = config.consumption_rules;
  for (const rule of rules) {
    if (pageCount <= rule.max_pages) {
      return rule.cost;
    }
  }
  return null;
}

export async function getConsumptionRules(): Promise<ConsumptionRule[]> {
  const config = await getBillingConfig();
  return config.consumption_rules as ConsumptionRule[];
}

export async function getMaxAllowedPages(): Promise<number> {
  const config = await getBillingConfig();
  return config.max_allowed_pages;
}
