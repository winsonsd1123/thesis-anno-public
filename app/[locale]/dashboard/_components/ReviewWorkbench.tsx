"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import type { ReviewRow } from "@/lib/types/review";
import { useDashboardStore } from "@/lib/store/useDashboardStore";
import { useReviewRealtime } from "@/lib/hooks/useReviewRealtime";
import { renameReview, deleteReview } from "@/lib/actions/review.action";
import { fetchReviewRow } from "@/lib/browser/fetch-review-row";
import { stagesToLogLines, stagesToProgressModels, type ProgressStageModel } from "@/lib/review/stagesUi";
import type { ReviewStageEntry } from "@/lib/types/review";
import type { ProgressConsoleAgent } from "./ProgressConsole";
import type { ReviewResult } from "@/lib/types/review";
import { HistorySidebar, type SidebarReviewItem } from "./HistorySidebar";
import { ReviewChatBoard } from "./ReviewChatBoard";
import { ProgressConsole } from "./ProgressConsole";
import { ReportViewer } from "./ReportViewer";

type Panel = "chat" | "progress" | "report";

function toSidebarItem(r: ReviewRow, t: ReturnType<typeof useTranslations>): SidebarReviewItem {
  let variant: SidebarReviewItem["variant"] = "pending";
  if (r.status === "completed" || r.status === "refunded") variant = "done";
  else if (r.status === "processing") variant = "processing";
  else if (r.status === "failed" || r.status === "needs_manual_review") variant = "failed";
  else if (r.status === "pending") variant = "pending";

  let statusLabel = t("historyStatusPending");
  if (r.status === "completed" || r.status === "refunded") statusLabel = t("historyStatusDone");
  else if (r.status === "processing") statusLabel = t("historyStatusProcessing");
  else if (r.status === "failed" || r.status === "needs_manual_review") statusLabel = t("historyStatusFailed");

  return {
    id: r.id,
    title: r.file_name?.trim() ? r.file_name : `#${r.id}`,
    statusLabel,
    variant,
  };
}

type ReviewWorkbenchProps = {
  balance: number | null;
  initialReviews: ReviewRow[];
  /** 仅管理员可在报告中切换「原始 JSON」 */
  isAdmin?: boolean;
  /** 客服微信号，来自服务端环境变量，可选 */
  supportWechat?: string;
};

function progressStageToConsoleRow(
  row: ProgressStageModel,
  t: (key: string, values?: Record<string, number | string>) => string
): ProgressConsoleAgent {
  const badge = t(`progressBadge_${row.stageStatus}`);
  const badgeTone: ProgressConsoleAgent["badgeTone"] =
    row.stageStatus === "pending"
      ? "pending"
      : row.stageStatus === "running"
        ? "running"
        : row.stageStatus === "done"
          ? "done"
          : row.stageStatus === "failed"
            ? "failed"
            : "skipped";

  let description: string;
  if (row.stageStatus === "failed" && row.log) {
    description = row.log;
  } else if (row.stageStatus === "running" && row.log) {
    description = row.log;
  } else if (row.stageStatus === "running") {
    description = t(`progressRunning_${row.key}`);
  } else if (row.stageStatus === "pending") {
    description = t("progressHintPending");
  } else if (row.stageStatus === "done") {
    description = t("progressHintDone");
  } else if (row.stageStatus === "failed") {
    description = t("progressHintFailedNoLog");
  } else {
    description = t("progressHintSkipped");
  }

  const metricsLine =
    row.refCounts && row.stageStatus === "running"
      ? t("progressRefMetrics", { current: row.refCounts.current, total: row.refCounts.total })
      : undefined;

  return {
    key: row.key,
    label: row.label,
    badge,
    badgeTone,
    description,
    barFillPercent: row.barFillPercent,
    metricsLine,
  };
}

export function ReviewWorkbench({ balance, initialReviews, isAdmin = false, supportWechat }: ReviewWorkbenchProps) {
  const t = useTranslations("dashboard.review");
  const tBill = useTranslations("billing");
  const router = useRouter();

  const activeReview = useDashboardStore((s) => s.activeReview);
  const hydrateFromReview = useDashboardStore((s) => s.hydrateFromReview);
  const clearSession = useDashboardStore((s) => s.clearSession);

  const [panelOverride, setPanelOverride] = useState<Panel | null>(null);
  const [copyHint, setCopyHint] = useState("");
  /** 切换历史记录拉取详情时：左侧立即高亮、右侧遮罩，避免「点了没反应」 */
  const [loadingReviewId, setLoadingReviewId] = useState<number | null>(null);

  const sidebarItems = useMemo(() => initialReviews.map((r) => toSidebarItem(r, t)), [initialReviews, t]);

  const derivedPanel = useMemo((): Panel => {
    if (!activeReview) return "chat";
    if (activeReview.status === "failed" || activeReview.status === "needs_manual_review") return "chat";
    if (activeReview.status === "processing") return "progress";
    if (activeReview.status === "completed") return "report";
    return "chat";
  }, [activeReview]);

  // 切换审阅或状态变化时收回手动 Tab，使界面跟随 derivedPanel（如进入 processing 自动到进度）
  const reviewSyncKey = `${activeReview?.id ?? "none"}:${activeReview?.status ?? "none"}`;
  useEffect(() => {
    setPanelOverride(null);
  }, [reviewSyncKey]);

  const panel = panelOverride ?? derivedPanel;

  useReviewRealtime(activeReview?.status === "processing" ? activeReview.id : null);

  const selectReview = useCallback(
    async (id: number) => {
      if (activeReview?.id === id) return;
      setLoadingReviewId(id);
      try {
        const r = await fetchReviewRow(id);
        if (r.ok) hydrateFromReview(r.review);
      } finally {
        setLoadingReviewId(null);
      }
    },
    [activeReview?.id, hydrateFromReview]
  );

  const newReview = useCallback(() => {
    clearSession();
    router.refresh();
  }, [clearSession, router]);

  const handleRename = useCallback(
    async (id: number, newTitle: string) => {
      await renameReview(id, newTitle);
      router.refresh();
    },
    [router]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const result = await deleteReview(id);
      if (!result.ok) return;
      if (activeReview?.id === id) {
        clearSession();
        setPanelOverride(null);
      }
      router.refresh();
    },
    [activeReview?.id, clearSession, router]
  );

  const handleRefreshProgress = useCallback(async () => {
    if (!activeReview?.id) return;
    const result = await fetchReviewRow(activeReview.id);
    if (result.ok) hydrateFromReview(result.review);
  }, [activeReview?.id, hydrateFromReview]);

  const progressAgents = useMemo((): ProgressConsoleAgent[] => {
    const labels = {
      format: t("progressAgentFormat"),
      logic: t("progressAgentLogic"),
      aitrace: t("progressAgentAitrace"),
      reference: t("progressAgentRefs"),
    };
    const models = stagesToProgressModels(activeReview?.stages, labels);
    return models.map((row) => progressStageToConsoleRow(row, t));
  }, [activeReview?.stages, t]);

  const logLines = useMemo(
    () => stagesToLogLines(activeReview?.stages, t("progressWaitLog")),
    [activeReview?.stages, t]
  );

  /** 有退款记录的 agent → 退款积分映射，用于报告 Tab 退款通知 */
  const agentRefunds = useMemo((): Partial<Record<string, number>> | undefined => {
    const stages = activeReview?.stages as ReviewStageEntry[] | undefined;
    if (!stages?.length) return undefined;
    const map: Partial<Record<string, number>> = {};
    for (const s of stages) {
      if (s.refunded_at && s.refunded_amount) map[s.agent] = s.refunded_amount;
    }
    return Object.keys(map).length ? map : undefined;
  }, [activeReview?.stages]);

  async function copyError() {
    const text = activeReview?.error_message ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(t("copied"));
      setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint("");
    }
  }

  const segments: { id: Panel; label: string }[] = [
    { id: "chat", label: t("panelChat") },
    { id: "progress", label: t("panelProgress") },
    { id: "report", label: t("panelReport") },
  ];

  const showManualReviewBanner = activeReview?.status === "needs_manual_review";
  const showErrorBanner =
    activeReview &&
    activeReview.status === "failed" &&
    activeReview.error_message;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        margin: "-24px -24px 0",
        padding: "0 24px 24px",
        minHeight: "calc(100vh - 56px - 24px)",
      }}
    >
      <div
        className="review-workbench-row"
        style={{
          display: "flex",
          gap: 16,
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <HistorySidebar
          title={t("historyTitle")}
          collapseLabel={t("historyCollapse")}
          expandLabel={t("historyExpand")}
          emptyHint={t("historyEmpty")}
          newReviewLabel={t("historyNewReview")}
          renameLabel={t("historyRename")}
          deleteLabel={t("historyDelete")}
          renamePlaceholder={t("historyRenamePlaceholder")}
          items={sidebarItems}
          selectedId={loadingReviewId ?? activeReview?.id ?? null}
          loadingItemId={loadingReviewId}
          onSelect={selectReview}
          onNewReview={newReview}
          onRename={handleRename}
          onDelete={handleDelete}
        />

        <section
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: 24,
            border: "1px solid var(--border)",
            background: "var(--bg-muted)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            {segments.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPanelOverride(s.id)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: panel === s.id ? "var(--brand-bg)" : "transparent",
                  color: panel === s.id ? "var(--brand)" : "var(--text-secondary)",
                }}
              >
                {s.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <Link
              href="/dashboard/billing"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                textDecoration: "none",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{tBill("balance")}</span>
              <span style={{ fontWeight: 700, color: "var(--brand)" }}>
                {balance ?? 0} {tBill("credits")}
              </span>
            </Link>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              overflow: "auto",
            }}
          >
            {loadingReviewId !== null ? (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: 24,
                  background: "color-mix(in srgb, var(--surface) 86%, transparent)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <Loader2
                  className="animate-spin motion-reduce:animate-none"
                  size={28}
                  strokeWidth={2}
                  aria-hidden
                  style={{ color: "var(--brand)", flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>
                  {t("loadingReviewDetail")}
                </span>
              </div>
            ) : null}
            <div
              style={{
                padding: "24px 20px 32px",
                opacity: loadingReviewId !== null ? 0.42 : 1,
                transition: "opacity 0.2s ease",
                pointerEvents: loadingReviewId !== null ? "none" : "auto",
              }}
            >
            {showManualReviewBanner ? (
              <div
                style={{
                  marginBottom: 20,
                  padding: "20px 22px",
                  borderRadius: 16,
                  border: "1px solid #f59e0b",
                  background: "rgba(245, 158, 11, 0.08)",
                  maxWidth: 720,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#b45309", marginBottom: 8 }}>
                  {t("manualReviewReassuranceTitle")}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, margin: 0 }}>
                  {t("manualReviewReassuranceBody", {
                    wechat: supportWechat || t("manualReviewWechatFallback"),
                  })}
                </p>
                {activeReview!.error_message && (
                  <details style={{ marginTop: 12 }}>
                    <summary
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {t("errorBannerTitle")}
                    </summary>
                    <pre
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                        marginTop: 8,
                        marginBottom: 8,
                        fontFamily: "inherit",
                      }}
                    >
                      {activeReview!.error_message}
                    </pre>
                    <button
                      type="button"
                      onClick={copyError}
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      {copyHint || t("copyError")}
                    </button>
                  </details>
                )}
              </div>
            ) : null}
            {showErrorBanner ? (
              <div
                style={{
                  marginBottom: 20,
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: "1px solid var(--danger)",
                  background: "rgba(239, 68, 68, 0.08)",
                  maxWidth: 720,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)", marginBottom: 8 }}>
                  {t("errorBannerTitle")}
                </div>
                <pre
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    marginBottom: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {activeReview!.error_message}
                </pre>
                <button
                  type="button"
                  onClick={copyError}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  {copyHint || t("copyError")}
                </button>
              </div>
            ) : null}

            {panel === "chat" && <ReviewChatBoard balance={balance} />}
            {panel === "progress" && (
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <ProgressConsole
                  title={t("progressTitle")}
                  barFootnote={t("progressBarFootnote")}
                  agents={progressAgents}
                  logLines={logLines}
                  onRefresh={handleRefreshProgress}
                  refreshLabel={t("progressRefresh")}
                  refreshingLabel={t("progressRefreshing")}
                />
                <p
                  style={{
                    marginTop: 16,
                    marginBottom: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                  }}
                >
                  {t("progressFooterHint")}
                </p>
              </div>
            )}
            {panel === "report" && (
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <ReportViewer
                  tabStructure={t("reportTabStructure")}
                  tabLogic={t("reportTabLogic")}
                  tabAiTrace={t("reportTabAiTrace")}
                  tabRefs={t("reportTabRefs")}
                  placeholder={t("reportPlaceholder")}
                  emptySection={t("reportEmptySection")}
                  exportLabel={t("reportDownload")}
                  exportFileStem={activeReview?.file_name ?? null}
                  allowRawJson={isAdmin}
                  result={(activeReview?.result as ReviewResult | null) ?? null}
                  agentRefunds={agentRefunds}
                />
              </div>
            )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
