export type ReviewStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_manual_review"
  | "refunded";

export type StageAgentStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** 与 `reviews.plan_options` 一致；未落库时由 normalize 使用默认（四项默认均开启） */
export type ReviewPlanOptions = {
  format: boolean;
  logic: boolean;
  aitrace: boolean;
  reference: boolean;
};

export type ReviewStageEntry = {
  agent: "format" | "logic" | "aitrace" | "reference";
  status: StageAgentStatus;
  log?: string;
  /** 局部退款已退回的积分（阶段三写入，幂等守卫） */
  refunded_amount?: number;
  /** 局部退款完成时间（存在即表示已退款） */
  refunded_at?: string;
};

export type ReviewRow = {
  id: number;
  user_id: string;
  file_url: string;
  file_name: string | null;
  word_count: number | null;
  domain: string | null;
  status: ReviewStatus;
  cost: number;
  /** 开始审阅时写入的各模块积分单价快照（billing v2），rollback 时清空 */
  cost_breakdown?: Record<string, number> | null;
  /** 累计已退款积分；真实净耗 = cost - refunded_amount */
  refunded_amount?: number;
  stages: ReviewStageEntry[] | null;
  /** 用户勾选的审阅维度；null 表示尚未持久化（按全选处理） */
  plan_options: ReviewPlanOptions | null;
  /** 自然语言格式要求；启用格式审阅时须非空 */
  format_guidelines?: string | null;
  /** 可选：缓存物理抽取 JSON */
  format_physical_extract?: unknown | null;
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
  aitrace_result?: unknown;
  reference_result?: unknown;
};

/** 从 `reviews.result` 取出格式物理抽取 JSON，供写入 `reviews.format_physical_extract` */
export function pickFormatPhysicalExtractFromReviewResult(result: ReviewResult): unknown | null {
  const fr = result.format_result;
  if (!fr || typeof fr !== "object") return null;
  const o = fr as Record<string, unknown>;
  if ("error" in o || "skipped" in o) return null;
  const obs = o.observability;
  if (!obs || typeof obs !== "object") return null;
  const pe = (obs as Record<string, unknown>).physical_extract;
  return pe !== undefined ? pe : null;
}

export type {
  DocxCompressedImagePart,
  DocxStyleAstNode,
  HybridDocxParseResult,
  MammothMessage,
} from "./docx-hybrid";

export const INITIAL_REVIEW_STAGES: ReviewStageEntry[] = [
  { agent: "format", status: "pending" },
  { agent: "logic", status: "pending" },
  { agent: "aitrace", status: "pending" },
  { agent: "reference", status: "pending" },
];

export function parseStages(raw: unknown): ReviewStageEntry[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: ReviewStageEntry[] = [];
  for (const s of data) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const agent = o.agent;
    if (agent !== "format" && agent !== "logic" && agent !== "aitrace" && agent !== "reference") continue;
    const st = o.status;
    const status: StageAgentStatus =
      st === "pending" || st === "running" || st === "done" || st === "failed" || st === "skipped"
        ? st
        : "pending";
    const log = typeof o.log === "string" ? o.log : undefined;
    out.push({ agent, status, ...(log ? { log } : {}) });
  }
  return out;
}
