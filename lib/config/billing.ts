import billingConfig from "@/config/billing.config.json";

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

export function getPackages(): BillingPackage[] {
  return billingConfig.packages as BillingPackage[];
}

export function getPackageById(id: string): BillingPackage | null {
  return getPackages().find((p) => p.id === id) ?? null;
}

export function estimateCost(pageCount: number): number | null {
  if (pageCount <= 0 || pageCount > billingConfig.max_allowed_pages) {
    return null;
  }
  const rules = billingConfig.consumption_rules as ConsumptionRule[];
  for (const rule of rules) {
    if (pageCount <= rule.max_pages) {
      return rule.cost;
    }
  }
  return null;
}

export function getConsumptionRules(): ConsumptionRule[] {
  return billingConfig.consumption_rules as ConsumptionRule[];
}

export function getMaxAllowedPages(): number {
  return billingConfig.max_allowed_pages;
}
