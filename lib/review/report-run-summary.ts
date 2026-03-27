export type ReportRunSummaryParts = { count: string; seconds: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function secFromMs(totalMs: number): string {
  return String(Math.round(totalMs / 1000));
}

/**
 * 从各维度 result 的 observability + issues/rows 条数推导「条数 / 耗时（秒）」展示用字符串。
 */
export function buildReportRunSummaryParts(
  tab: "structure" | "logic" | "aitrace" | "refs",
  payload: Record<string, unknown>,
  issuesOrRowsCount: number
): ReportRunSummaryParts {
  const obs = isRecord(payload.observability) ? payload.observability : null;
  const countStr = String(issuesOrRowsCount);

  if (tab === "structure") {
    if (!obs) return { count: countStr, seconds: "—" };
    const s = Number(obs.semantic_llm_ms) || 0;
    const e = Number(obs.spec_extract_ms) || 0;
    const r = Number(obs.rules_ms) || 0;
    const total = s + e + r;
    return { count: countStr, seconds: total > 0 ? secFromMs(total) : "—" };
  }

  if (tab === "logic") {
    if (!obs) return { count: countStr, seconds: "—" };
    const p1 = obs.pass1_duration_ms;
    const p2 = obs.pass2_duration_ms;
    const has = p1 != null || p2 != null;
    const totalMs = (Number(p1) || 0) + (Number(p2) || 0);
    const count =
      obs.merged_issue_count !== undefined && obs.merged_issue_count !== null
        ? String(obs.merged_issue_count)
        : countStr;
    return { count, seconds: has ? secFromMs(totalMs) : "—" };
  }

  if (tab === "aitrace") {
    const dm = obs?.duration_ms;
    return {
      count: countStr,
      seconds: obs != null && dm != null ? secFromMs(Number(dm) || 0) : "—",
    };
  }

  // refs
  const dm = obs?.duration_ms;
  return {
    count: countStr,
    seconds: obs != null && dm != null ? secFromMs(Number(dm) || 0) : "—",
  };
}
