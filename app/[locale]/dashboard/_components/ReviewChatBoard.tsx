"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createReviewFromDocxUpload,
  updateReviewDomain,
  replaceReviewPdf,
  updateReviewFormatGuidelines,
  getDefaultFormatGuidelinesZh,
} from "@/lib/actions/review.actions";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { fetchReviewRow } from "@/lib/browser/fetch-review-row";
import { startReviewEngine } from "@/lib/actions/trigger.actions";
import { estimateCost } from "@/lib/actions/billing.actions";
import type { CostBreakdownSnapshot } from "@/lib/config/billing";
import { useDashboardStore } from "@/lib/store/useDashboardStore";
import { AssistantMessageRow, UserMessageRow } from "./ChatMessageRows";
import { UploadForm } from "./UploadForm";
import { PaperCardBubble } from "./PaperCardBubble";
import { DomainInfoBubble } from "./DomainInfoBubble";
import { PlanConfirmBubble } from "./PlanConfirmBubble";
import type { StaticPlanStepId } from "@/lib/review/buildStaticPlan";

function planItemLabel(id: StaticPlanStepId, tr: (k: string) => string): string {
  if (id === "format") return tr("planItemFormat");
  if (id === "logic") return tr("planItemLogic");
  if (id === "aitrace") return tr("planItemAitrace");
  return tr("planItemRefs");
}

type ReviewChatBoardProps = {
  /** 当前用户积分余额，由 ReviewWorkbench 从服务端传入 */
  balance?: number | null;
};

export function ReviewChatBoard({ balance }: ReviewChatBoardProps) {
  const t = useTranslations("dashboard.review");
  const uiLocale = useLocale() === "en" ? "en" : "zh";
  const router = useRouter();
  const activeReview = useDashboardStore((s) => s.activeReview);
  const bubbles = useDashboardStore((s) => s.bubbles);
  const planVersion = useDashboardStore((s) => s.planVersion);
  const hydrateFromReview = useDashboardStore((s) => s.hydrateFromReview);
  const updateLocalDomain = useDashboardStore((s) => s.updateLocalDomain);
  const bumpPlanVersion = useDashboardStore((s) => s.bumpPlanVersion);
  const updatePlanOptions = useDashboardStore((s) => s.updatePlanOptions);

  const [uploadError, setUploadError] = useState("");
  const [planError, setPlanError] = useState("");
  const [planEstimatedCredits, setPlanEstimatedCredits] = useState<number | null>(null);
  const [planEstimatedBreakdown, setPlanEstimatedBreakdown] = useState<CostBreakdownSnapshot | null>(null);
  const [planCreditsLoading, setPlanCreditsLoading] = useState(false);
  const [formatDraft, setFormatDraft] = useState("");
  const [importFormatBusy, setImportFormatBusy] = useState(false);

  useEffect(() => {
    const fg = activeReview?.format_guidelines;
    setFormatDraft(typeof fg === "string" ? fg : "");
  }, [activeReview?.id, activeReview?.format_guidelines]);

  const te = useCallback(
    (code: string) => {
      const map: Record<string, string> = {
        NOT_AUTHENTICATED: t("errors.NOT_AUTHENTICATED"),
        FILE_REQUIRED: t("errors.FILE_REQUIRED"),
        DOMAIN_REQUIRED: t("errors.DOMAIN_REQUIRED"),
        FILE_TOO_LARGE: t("errors.FILE_TOO_LARGE"),
        FILE_NOT_DOCX: t("errors.FILE_NOT_DOCX"),
        UPLOAD_FAILED: t("errors.UPLOAD_FAILED"),
        NOT_FOUND: t("errors.NOT_FOUND"),
        INVALID_STATUS: t("errors.INVALID_STATUS"),
        PAGE_COUNT_OUT_OF_RANGE: t("errors.PAGE_COUNT_OUT_OF_RANGE"),
        PAGE_COUNT_REQUIRED: t("errors.PAGE_COUNT_REQUIRED"),
        PAGE_COUNT_INVALID: t("errors.PAGE_COUNT_INVALID"),
        PAGE_COUNT_PARSE: t("errors.PAGE_COUNT_PARSE"),
        WORD_COUNT_OUT_OF_RANGE: t("errors.WORD_COUNT_OUT_OF_RANGE"),
        WORD_COUNT_FAILED: t("errors.WORD_COUNT_FAILED"),
        STAGING_INVALID: t("errors.STAGING_INVALID"),
        COST_UNAVAILABLE: t("errors.COST_UNAVAILABLE"),
        INSUFFICIENT_CREDITS: t("errors.INSUFFICIENT_CREDITS"),
        DOMAIN_UPDATE_FAILED: t("errors.DOMAIN_UPDATE_FAILED"),
        START_FAILED: t("errors.START_FAILED"),
        TRIGGER_NOT_CONFIGURED: t("errors.TRIGGER_NOT_CONFIGURED"),
        TRIGGER_DISPATCH_FAILED: t("errors.TRIGGER_DISPATCH_FAILED"),
        ROLLBACK_FAILED: t("errors.ROLLBACK_FAILED"),
        ROLLBACK_INVALID_COST: t("errors.ROLLBACK_INVALID_COST"),
        RUN_ALREADY_ATTACHED: t("errors.RUN_ALREADY_ATTACHED"),
        FORMAT_GUIDELINES_REQUIRED: t("errors.FORMAT_GUIDELINES_REQUIRED"),
        GENERIC: t("errors.GENERIC"),
        UNKNOWN: t("errors.GENERIC"),
      };
      return map[code] ?? t("errors.GENERIC");
    },
    [t]
  );

  const planOptionsKey = activeReview?.plan_options
    ? JSON.stringify(activeReview.plan_options)
    : null;

  const insufficientCredits =
    planEstimatedCredits != null &&
    balance != null &&
    planEstimatedCredits > balance;

  useEffect(() => {
    let cancelled = false;
    const wc = activeReview?.word_count;
    if (activeReview?.status === "pending" && wc != null && wc > 0) {
      setPlanCreditsLoading(true);
      setPlanEstimatedCredits(null);
      const plan = activeReview.plan_options ?? undefined;
      estimateCost(wc, plan).then((r) => {
        if (cancelled) return;
        setPlanCreditsLoading(false);
        setPlanEstimatedCredits(r.cost ?? null);
        setPlanEstimatedBreakdown(r.breakdown ?? null);
      });
    } else {
      setPlanCreditsLoading(false);
      setPlanEstimatedCredits(null);
      setPlanEstimatedBreakdown(null);
    }
    return () => {
      cancelled = true;
    };
  }, [activeReview?.id, activeReview?.status, activeReview?.word_count, planOptionsKey]);

  const paperMetaLabel = useCallback(
    (wordCount: number | null) => {
      if (wordCount != null) return t("paperSubtitleInPlan");
      return t("paperMetaPending");
    },
    [t]
  );

  const paperBubble = useMemo(() => bubbles.find((b) => b.type === "paper_info"), [bubbles]);
  const domainBubble = useMemo(() => bubbles.find((b) => b.type === "domain_info"), [bubbles]);
  const planBubble = useMemo(() => bubbles.find((b) => b.type === "review_plan"), [bubbles]);

  async function handleCreateReview(fd: FormData): Promise<boolean> {
    setUploadError("");
    const r = await createReviewFromDocxUpload(fd);
    if (!r.ok) {
      setUploadError(te(r.error));
      return false;
    }
    const row = await fetchReviewRow(r.reviewId);
    if (row.ok) {
      hydrateFromReview(row.review);
      router.refresh();
      return true;
    }
    setUploadError(
      row.error === "NOT_AUTHENTICATED"
        ? te("NOT_AUTHENTICATED")
        : row.error === "NOT_FOUND"
          ? te("NOT_FOUND")
          : te("UNKNOWN")
    );
    return false;
  }

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Upload form（用户右侧）── */}
        {!activeReview ? (
          <UserMessageRow name={t("chatRoleUser")} userMark={t("chatUserAvatarMark")}>
            <UploadForm
              title={t("uploadTitle")}
              dragLabel={t("uploadDragLabel")}
              sizeHint={t("uploadSizeHint")}
              clearFileLabel={t("uploadClearFile")}
              domainPlaceholder={t("domainPlaceholder")}
              submitLabel={t("uploadConfirmCreate")}
              submitBusyLabel={t("uploadConfirmBusy")}
              submitBusyHint={t("uploadConfirmBusyHint")}
              embeddedObjectTip={t("docxEmbeddedObjectTip")}
              invalidFileLabel={t("uploadInvalidFile")}
              onSubmit={handleCreateReview}
              errorMessage={uploadError}
            />
          </UserMessageRow>
        ) : null}

        {/* ── ThesisAI 欢迎消息 + 论文卡 + 领域 chip ── */}
        {activeReview && paperBubble && domainBubble ? (
          <AssistantMessageRow name={t("assistantLabel")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 欢迎语气泡 */}
              {activeReview.status === "pending" ? (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "4px 14px 14px 14px",
                    background: "var(--bg-subtle)",
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "var(--text-secondary)",
                    maxWidth: 440,
                    display: "inline-block",
                  }}
                >
                  {t("chatWelcomeAfterUpload")}
                </div>
              ) : null}

              {/* 论文卡 */}
              <PaperCardBubble
                title={t("paperCardTitle")}
                formatBadgeLabel={t("paperFormatBadge")}
                fileName={paperBubble.fileName}
                pagesLabel={paperMetaLabel(paperBubble.wordCount)}
                invalidFileLabel={t("uploadInvalidFile")}
                allowReplace={activeReview.status === "pending"}
                replaceLabel={t("paperReplaceHover")}
                replacingLabel={t("paperReplacing")}
                onReplaceFile={
                  activeReview.status === "pending"
                    ? async (file) => {
                        const fd = new FormData();
                        fd.set("file", file);
                        const r = await replaceReviewPdf(paperBubble.reviewId, fd);
                        if (!r.ok) return { ok: false, message: te(r.error) };
                        const row = await fetchReviewRow(paperBubble.reviewId);
                        if (!row.ok)
                          return {
                            ok: false,
                            message:
                              row.error === "NOT_AUTHENTICATED"
                                ? te("NOT_AUTHENTICATED")
                                : row.error === "NOT_FOUND"
                                  ? te("NOT_FOUND")
                                  : te("UNKNOWN"),
                          };
                        hydrateFromReview(row.review);
                        bumpPlanVersion();
                        router.refresh();
                        return { ok: true };
                      }
                    : undefined
                }
              />

              {/* 领域 chip */}
              <DomainInfoBubble
                title={t("domainBubbleTitle")}
                domainPlaceholder={t("domainPlaceholder")}
                saveLabel={t("domainSave")}
                savingLabel={t("domainSaving")}
                cancelLabel={t("domainCancel")}
                initialDomain={domainBubble.domain}
                editable={activeReview.status === "pending"}
                domainNotSetLabel={t("domainNotSet")}
                editPencilAriaLabel={t("domainEditPencilAria")}
                onSave={async (domain) => {
                  const r = await updateReviewDomain(domainBubble.reviewId, domain);
                  if (!r.ok) {
                    return {
                      ok: false,
                      message: te(r.error === "NOT_FOUND" ? "NOT_FOUND" : "DOMAIN_UPDATE_FAILED"),
                    };
                  }
                  updateLocalDomain(domain);
                  const row = await fetchReviewRow(domainBubble.reviewId);
                  if (row.ok) hydrateFromReview(row.review);
                  bumpPlanVersion();
                  router.refresh();
                  return { ok: true };
                }}
              />
            </div>
          </AssistantMessageRow>
        ) : null}

        {/* ── 审阅计划 ── */}
        {activeReview && planBubble ? (
          <AssistantMessageRow
            key={`plan-${planBubble.reviewId}-v${planVersion}`}
            name={t("assistantLabel")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
              {/* 计划前的一句提示 */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "4px 14px 14px 14px",
                  background: "var(--bg-subtle)",
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--text-secondary)",
                  maxWidth: 440,
                  display: "inline-block",
                }}
              >
                {activeReview.status === "pending"
                  ? t("chatPlanIntro")
                  : activeReview.status === "processing"
                    ? t("chatPlanRunningIntro")
                    : t("chatPlanArchiveIntro")}
              </div>
              {planError ? (
                <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{planError}</p>
              ) : null}
              <PlanConfirmBubble
                title={t("planTitle")}
                domainBadgePrefix={t("planDomainPrefix")}
                badge={
                  planBubble.domain.trim().length > 0
                    ? planBubble.domain
                    : t("planBadgeGeneral")
                }
                steps={planBubble.stepIds.map((id) => ({
                  id,
                  label: planItemLabel(id, t),
                }))}
                planOptions={planBubble.planOptions}
                planEditable={activeReview.status === "pending"}
                onPlanChange={updatePlanOptions}
                wordCount={activeReview.word_count}
                showCreditsEstimate={activeReview.status === "pending"}
                creditsLoading={planCreditsLoading}
                estimatedCredits={planEstimatedCredits}
                labelWordCount={t("planStatsWordLabel")}
                wordCountScopeHint={t("planStatsWordScope")}
                labelEstimatedCredits={t("planStatsCreditsLabel")}
                creditsLoadingText={t("planStatsCreditsLoading")}
                creditsValueText={
                  planEstimatedCredits != null
                    ? t("planStatsCreditsValue", { credits: planEstimatedCredits })
                    : undefined
                }
                showFormatRequirements={planBubble.planOptions.format}
                formatGuidelinesValue={formatDraft}
                onFormatGuidelinesChange={setFormatDraft}
                onImportDefaultFormat={
                  activeReview.status === "pending"
                    ? async () => {
                        setImportFormatBusy(true);
                        try {
                          const r = await getDefaultFormatGuidelinesZh();
                          if (r.ok) setFormatDraft(r.text);
                          else setPlanError(te(r.error));
                        } finally {
                          setImportFormatBusy(false);
                        }
                      }
                    : undefined
                }
                formatRequirementsLabel={t("formatRequirementsLabel")}
                formatRequirementsPlaceholder={t("formatRequirementsPlaceholder")}
                formatRequirementsHint={
                  activeReview.status === "pending"
                    ? t("formatRequirementsHint")
                    : planBubble.planOptions.format
                      ? t("formatRequirementsHintApplied")
                      : t("formatRequirementsHint")
                }
                importDefaultFormatLabel={t("importDefaultFormat")}
                importDefaultFormatBusy={importFormatBusy}
                importDefaultFormatBusyLabel={t("importDefaultFormatBusy")}
                startLabel={t("planStart")}
                startingLabel={t("planStarting")}
                showStartButton={activeReview.status === "pending"}
                planScopeSummary={
                  activeReview.status !== "pending" ? t("planScopeSummary") : undefined
                }
                footerNote={activeReview.status === "processing" ? t("planRunningFooter") : undefined}
                embeddedObjectTip={
                  activeReview.status === "pending" ? t("docxEmbeddedObjectTip") : undefined
                }
                stepCosts={planEstimatedBreakdown ?? undefined}
                insufficientCredits={insufficientCredits}
                insufficientCreditsHint={insufficientCredits ? t("planInsufficientCredits") : undefined}
                rechargeHref="/dashboard/billing"
                disabled={activeReview.status !== "pending"}
                onStart={async () => {
                  setPlanError("");
                  if (planBubble.planOptions.format) {
                    const trimmed = formatDraft.trim();
                    if (!trimmed) {
                      setPlanError(te("FORMAT_GUIDELINES_REQUIRED"));
                      return;
                    }
                    const save = await updateReviewFormatGuidelines(planBubble.reviewId, formatDraft);
                    if (!save.ok) {
                      setPlanError(te(save.error));
                      return;
                    }
                  }
                  const r = await startReviewEngine(
                    planBubble.reviewId,
                    planBubble.planOptions,
                    uiLocale
                  );
                  if (!r.ok) {
                    setPlanError(te(r.error));
                    return;
                  }
                  const row = await fetchReviewRow(planBubble.reviewId);
                  if (row.ok) {
                    hydrateFromReview(row.review);
                    router.refresh();
                  }
                }}
              />
            </div>
          </AssistantMessageRow>
        ) : null}
      </div>
    </div>
  );
}
