import type { ReviewStageEntry, StageAgentStatus } from "@/lib/types/review";

/** 解析参考文献阶段 log：`已核查 3/12 条 · …` */
export function parseReferenceProgressFromLog(log: string | undefined): { current: number; total: number } | null {
  if (!log) return null;
  const m = log.match(/已核查\s*(\d+)\s*\/\s*(\d+)\s*条/);
  if (!m) return null;
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;
  return { current: Math.min(current, total), total };
}

export type ProgressStageModel = {
  key: "format" | "logic" | "aitrace" | "reference";
  label: string;
  stageStatus: StageAgentStatus;
  log?: string;
  /** 条数进度（仅参考文献 running 且 log 可解析时） */
  refFraction: number | null;
  /** 与 refFraction 对应的条数，供 UI 展示「已核查 a/b 条」 */
  refCounts: { current: number; total: number } | null;
  /** 进度条填充 0–100；running 且无明确比例时为 null（走不确定动画） */
  barFillPercent: number | null;
};

export function stagesToProgressModels(
  stages: ReviewStageEntry[] | null | undefined,
  labels: { format: string; logic: string; aitrace: string; reference: string }
): ProgressStageModel[] {
  const order = ["format", "logic", "aitrace", "reference"] as const;
  const list = stages ?? [];

  return order.map((agent) => {
    const e = list.find((x) => x.agent === agent);
    const stageStatus: StageAgentStatus = e?.status ?? "pending";
    const log = e?.log?.trim() ? e.log.trim() : undefined;

    let refFraction: number | null = null;
    let refCounts: { current: number; total: number } | null = null;
    let barFillPercent: number | null = null;

    if (stageStatus === "pending") {
      barFillPercent = 0;
    } else if (stageStatus === "skipped") {
      barFillPercent = 0;
    } else if (stageStatus === "done") {
      barFillPercent = 100;
    } else if (stageStatus === "failed") {
      barFillPercent = 100;
    } else if (stageStatus === "running") {
      if (agent === "reference") {
        const pr = parseReferenceProgressFromLog(log);
        if (pr) {
          refFraction = pr.current / pr.total;
          refCounts = pr;
          barFillPercent = Math.round((100 * pr.current) / pr.total);
        }
      }
    }

    return {
      key: agent,
      label: labels[agent],
      stageStatus,
      log,
      refFraction,
      refCounts,
      barFillPercent,
    };
  });
}

export function stagesToLogLines(stages: ReviewStageEntry[] | null | undefined, fallback: string): string[] {
  const list = stages ?? [];
  const fromLogs = list.map((s) => s.log).filter((x): x is string => Boolean(x && x.trim()));
  if (fromLogs.length > 0) return fromLogs;
  return [fallback];
}
