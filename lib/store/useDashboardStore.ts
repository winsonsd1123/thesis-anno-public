import { create } from "zustand";
import type { ReviewRow } from "@/lib/types/review";
import { parseStages } from "@/lib/types/review";
import { buildStaticPlan, type StaticPlanStepId } from "@/lib/review/buildStaticPlan";
import { normalizePlanOptions } from "@/lib/review/planOptions";
import type { ReviewPlanOptions } from "@/lib/types/review";

export type ChatBubble =
  | { id: string; type: "paper_info"; reviewId: number; fileName: string; wordCount: number | null }
  | { id: string; type: "domain_info"; reviewId: number; domain: string }
  | {
      id: string;
      type: "review_plan";
      reviewId: number;
      domain: string;
      stepIds: StaticPlanStepId[];
      planOptions: ReviewPlanOptions;
    };

function normalizeRow(r: ReviewRow): ReviewRow {
  return {
    ...r,
    stages: parseStages(r.stages),
  };
}

function buildBubbles(r: ReviewRow): ChatBubble[] {
  const base: ChatBubble[] = [
    {
      id: `paper-${r.id}`,
      type: "paper_info",
      reviewId: r.id,
      fileName: r.file_name ?? "—",
      wordCount: r.word_count,
    },
    { id: `domain-${r.id}`, type: "domain_info", reviewId: r.id, domain: r.domain ?? "" },
  ];
  // 待开始、进行中与已结束均保留计划卡片（静态快照），避免任务完成后对话里计划气泡被清空
  const plan = buildStaticPlan(r.domain ?? "");
  base.push({
    id: `plan-${r.id}`,
    type: "review_plan",
    reviewId: r.id,
    domain: plan.domain,
    stepIds: [...plan.stepIds],
    planOptions: normalizePlanOptions(r.plan_options),
  });
  return base;
}

type DashboardState = {
  activeReview: ReviewRow | null;
  bubbles: ChatBubble[];
  /** Bumps when domain or thesis file changes so the plan bubble remounts with fresh copy */
  planVersion: number;
  hydrateFromReview: (r: ReviewRow) => void;
  patchFromServer: (raw: Record<string, unknown>) => void;
  updateLocalDomain: (domain: string) => void;
  /** pending 时用户勾选计划项，仅更新本地 session（开始审阅时随 RPC 落库） */
  updatePlanOptions: (next: ReviewPlanOptions) => void;
  bumpPlanVersion: () => void;
  clearSession: () => void;
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  activeReview: null,
  bubbles: [],
  planVersion: 0,

  hydrateFromReview: (r) => {
    const row = normalizeRow(r);
    const prev = get().activeReview;
    const sameSession = prev !== null && prev.id === row.id;
    set({
      activeReview: row,
      bubbles: buildBubbles(row),
      planVersion: sameSession ? get().planVersion : 0,
    });
  },

  patchFromServer: (raw) => {
    const cur = get().activeReview;
    if (!cur || Number(raw.id) !== cur.id) return;
    const merged = { ...cur, ...raw } as ReviewRow;
    const row = normalizeRow(merged);
    set({
      activeReview: row,
      bubbles: buildBubbles(row),
      planVersion: get().planVersion,
    });
  },

  bumpPlanVersion: () => set((s) => ({ planVersion: s.planVersion + 1 })),

  updateLocalDomain: (domain) => {
    const cur = get().activeReview;
    if (!cur) return;
    const row = normalizeRow({ ...cur, domain });
    set({ activeReview: row, bubbles: buildBubbles(row) });
  },

  updatePlanOptions: (next) => {
    const cur = get().activeReview;
    if (!cur) return;
    const row = normalizeRow({ ...cur, plan_options: next });
    set({ activeReview: row, bubbles: buildBubbles(row) });
  },

  clearSession: () => set({ activeReview: null, bubbles: [], planVersion: 0 }),
}));
