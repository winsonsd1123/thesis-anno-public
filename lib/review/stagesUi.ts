import type { ReviewStageEntry } from "@/lib/types/review";

export type ProgressAgentUi = {
  key: "format" | "logic" | "reference";
  label: string;
  progress: number;
  status: "running" | "done" | "pending";
};

export function stagesToProgressAgents(
  stages: ReviewStageEntry[] | null | undefined,
  labels: { format: string; logic: string; reference: string }
): ProgressAgentUi[] {
  const order = ["format", "logic", "reference"] as const;
  const list = stages ?? [];

  return order.map((agent) => {
    const e = list.find((x) => x.agent === agent);
    const st = e?.status ?? "pending";
    let progress = 0;
    let status: ProgressAgentUi["status"] = "pending";
    if (st === "done" || st === "failed") {
      progress = 100;
      status = "done";
    } else if (st === "running") {
      progress = 60;
      status = "running";
    }
    return {
      key: agent,
      label: labels[agent],
      progress,
      status,
    };
  });
}

export function stagesToLogLines(stages: ReviewStageEntry[] | null | undefined, fallback: string): string[] {
  const list = stages ?? [];
  const fromLogs = list.map((s) => s.log).filter((x): x is string => Boolean(x && x.trim()));
  if (fromLogs.length > 0) return fromLogs;
  return [fallback];
}
