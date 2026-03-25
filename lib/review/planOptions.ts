import type { ReviewPlanOptions } from "@/lib/types/review";
import { parseStages } from "@/lib/types/review";
import { STATIC_PLAN_STEP_IDS } from "@/lib/review/buildStaticPlan";

export const DEFAULT_REVIEW_PLAN_OPTIONS: ReviewPlanOptions = {
  format: true,
  logic: true,
  aitrace: true,
  reference: true,
};

export function normalizePlanOptions(raw: unknown): ReviewPlanOptions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REVIEW_PLAN_OPTIONS };
  const o = raw as Record<string, unknown>;
  const out = { ...DEFAULT_REVIEW_PLAN_OPTIONS };
  for (const k of STATIC_PLAN_STEP_IDS) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  return out;
}

export function planHasAtLeastOneEnabled(plan: ReviewPlanOptions): boolean {
  return STATIC_PLAN_STEP_IDS.some((k) => plan[k]);
}

/**
 * 编排器以 `reviews.stages` 为准（RPC 写入 skipped/pending）；无 stages 时回退 `plan_options`。
 * 避免 Trigger 侧 `plan_options` 未回传或旧行导致误当成「全选」。
 */
export function resolveEnabledAgents(stagesRaw: unknown, planOptionsRaw: unknown): ReviewPlanOptions {
  const fallback = normalizePlanOptions(planOptionsRaw);
  const stages = parseStages(stagesRaw);
  if (stages.length === 0) return fallback;
  const out: ReviewPlanOptions = { ...DEFAULT_REVIEW_PLAN_OPTIONS };
  for (const k of STATIC_PLAN_STEP_IDS) {
    const e = stages.find((s) => s.agent === k);
    if (e) {
      out[k] = e.status !== "skipped";
    } else {
      out[k] = fallback[k];
    }
  }
  return out;
}
