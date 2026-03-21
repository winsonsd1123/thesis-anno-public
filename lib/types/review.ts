export type ReviewStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_manual_review"
  | "refunded";

export type StageAgentStatus = "pending" | "running" | "done" | "failed";

export type ReviewStageEntry = {
  agent: "format" | "logic" | "reference";
  status: StageAgentStatus;
  log?: string;
};

export type ReviewRow = {
  id: number;
  user_id: string;
  file_url: string;
  file_name: string | null;
  page_count: number | null;
  domain: string | null;
  status: ReviewStatus;
  cost: number;
  stages: ReviewStageEntry[] | null;
  result: ReviewResult | null;
  error_message: string | null;
  trigger_run_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** Stored in reviews.result — align with orchestrator when implemented */
export type ReviewResult = {
  format_result?: unknown;
  logic_result?: unknown;
  reference_result?: unknown;
};

export const INITIAL_REVIEW_STAGES: ReviewStageEntry[] = [
  { agent: "format", status: "pending" },
  { agent: "logic", status: "pending" },
  { agent: "reference", status: "pending" },
];

export function parseStages(raw: unknown): ReviewStageEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewStageEntry[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const agent = o.agent;
    if (agent !== "format" && agent !== "logic" && agent !== "reference") continue;
    const st = o.status;
    const status: StageAgentStatus =
      st === "pending" || st === "running" || st === "done" || st === "failed" ? st : "pending";
    const log = typeof o.log === "string" ? o.log : undefined;
    out.push({ agent, status, ...(log ? { log } : {}) });
  }
  return out;
}
