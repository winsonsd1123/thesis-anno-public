/**
 * Static review plan (no LLM). Step ids map to i18n keys dashboard.review.planItem*.
 */
export const STATIC_PLAN_STEP_IDS = ["format", "logic", "aitrace", "reference"] as const;

export type StaticPlanStepId = (typeof STATIC_PLAN_STEP_IDS)[number];

export function buildStaticPlan(domain: string): {
  domain: string;
  stepIds: StaticPlanStepId[];
} {
  const d = domain.trim() || "";
  return {
    domain: d,
    stepIds: [...STATIC_PLAN_STEP_IDS],
  };
}
