"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { initializeReview, updateReviewDomain, replaceReviewPdf } from "@/lib/actions/review.action";
import { fetchReviewRow } from "@/lib/client/fetchReviewRow";
import { startReviewEngine } from "@/lib/actions/trigger.action";
import { getPdfPageCountFromFile } from "@/lib/client/pdfPageCount";
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

export function ReviewChatBoard() {
  const t = useTranslations("dashboard.review");
  const router = useRouter();
  const activeReview = useDashboardStore((s) => s.activeReview);
  const bubbles = useDashboardStore((s) => s.bubbles);
  const planVersion = useDashboardStore((s) => s.planVersion);
  const hydrateFromReview = useDashboardStore((s) => s.hydrateFromReview);
  const updateLocalDomain = useDashboardStore((s) => s.updateLocalDomain);
  const bumpPlanVersion = useDashboardStore((s) => s.bumpPlanVersion);

  const [uploadError, setUploadError] = useState("");
  const [planError, setPlanError] = useState("");

  const te = useCallback(
    (code: string) => {
      const map: Record<string, string> = {
        NOT_AUTHENTICATED: t("errors.NOT_AUTHENTICATED"),
        FILE_REQUIRED: t("errors.FILE_REQUIRED"),
        DOMAIN_REQUIRED: t("errors.DOMAIN_REQUIRED"),
        FILE_TOO_LARGE: t("errors.FILE_TOO_LARGE"),
        FILE_NOT_PDF: t("errors.FILE_NOT_PDF"),
        UPLOAD_FAILED: t("errors.UPLOAD_FAILED"),
        NOT_FOUND: t("errors.NOT_FOUND"),
        INVALID_STATUS: t("errors.INVALID_STATUS"),
        PAGE_COUNT_OUT_OF_RANGE: t("errors.PAGE_COUNT_OUT_OF_RANGE"),
        PAGE_COUNT_REQUIRED: t("errors.PAGE_COUNT_REQUIRED"),
        PAGE_COUNT_INVALID: t("errors.PAGE_COUNT_INVALID"),
        PAGE_COUNT_PARSE: t("errors.PAGE_COUNT_PARSE"),
        COST_UNAVAILABLE: t("errors.COST_UNAVAILABLE"),
        INSUFFICIENT_CREDITS: t("errors.INSUFFICIENT_CREDITS"),
        DOMAIN_UPDATE_FAILED: t("errors.DOMAIN_UPDATE_FAILED"),
        START_FAILED: t("errors.START_FAILED"),
        TRIGGER_NOT_CONFIGURED: t("errors.TRIGGER_NOT_CONFIGURED"),
        TRIGGER_DISPATCH_FAILED: t("errors.TRIGGER_DISPATCH_FAILED"),
        ROLLBACK_FAILED: t("errors.ROLLBACK_FAILED"),
        ROLLBACK_INVALID_COST: t("errors.ROLLBACK_INVALID_COST"),
        RUN_ALREADY_ATTACHED: t("errors.RUN_ALREADY_ATTACHED"),
        GENERIC: t("errors.GENERIC"),
        UNKNOWN: t("errors.GENERIC"),
      };
      return map[code] ?? t("errors.GENERIC");
    },
    [t]
  );

  const paperBubble = useMemo(() => bubbles.find((b) => b.type === "paper_info"), [bubbles]);
  const domainBubble = useMemo(() => bubbles.find((b) => b.type === "domain_info"), [bubbles]);
  const planBubble = useMemo(() => bubbles.find((b) => b.type === "review_plan"), [bubbles]);

  async function handleUpload(fd: FormData): Promise<boolean> {
    setUploadError("");
    const r = await initializeReview(fd);
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
              submitLabel={t("submitUpload")}
              submittingLabel={t("uploadSubmitting")}
              parsingPagesLabel={t("uploadParsingPages")}
              parsePagesErrorLabel={t("errors.PAGE_COUNT_PARSE")}
              onSubmitUpload={handleUpload}
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
                fileName={paperBubble.fileName}
                pagesLabel={
                  paperBubble.pageCount != null
                    ? t("paperPages", { count: paperBubble.pageCount })
                    : t("paperPagesUnknown")
                }
                allowReplace={activeReview.status === "pending"}
                replaceLabel={t("paperReplaceHover")}
                replacingLabel={t("paperReplacing")}
                onReplaceFile={
                  activeReview.status === "pending"
                    ? async (file) => {
                        let pageCount: number;
                        try {
                          pageCount = await getPdfPageCountFromFile(file);
                        } catch {
                          return { ok: false, message: te("PAGE_COUNT_PARSE") };
                        }
                        const fd = new FormData();
                        fd.set("file", file);
                        fd.set("pageCount", String(pageCount));
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
                badge={
                  planBubble.domain.trim().length > 0
                    ? planBubble.domain
                    : t("planBadgeGeneral")
                }
                items={planBubble.stepIds.map((id) => planItemLabel(id, t))}
                startLabel={t("planStart")}
                startingLabel={t("planStarting")}
                showStartButton={activeReview.status === "pending"}
                footerNote={activeReview.status === "processing" ? t("planRunningFooter") : undefined}
                disabled={activeReview.status !== "pending"}
                onStart={async () => {
                  setPlanError("");
                  const r = await startReviewEngine(planBubble.reviewId);
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
