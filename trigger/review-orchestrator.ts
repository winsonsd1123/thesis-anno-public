import { task } from "@trigger.dev/sdk/v3";
import { getMaxReferenceCountForWordsDirect } from "@/lib/config/billing";
import { QUEUE_LIMITS } from "@/lib/config/queue-limits";
import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { storageDAL } from "@/lib/dal/storage.dal";
import { promptsSchema } from "@/lib/schemas/config.schemas";
import type { PromptsConfig } from "@/lib/schemas/config.schemas";
import { getPromptsDirect } from "@/lib/services/config.service";
import promptsDefaultJson from "@/config/prompts.default.json";
import { parseHybridDocx } from "@/lib/review/hybrid-docx-parser";
import {
  analyzeFormat,
  analyzeFormatLocalChunk,
} from "@/lib/services/review/format.service";
import type {
  ReviewAnalyzeContext,
  RunFormatLocalChunksFn,
  FormatLocalSemanticResult,
} from "@/lib/services/review/format.service";
import { analyzeLogic } from "@/lib/services/review/logic.service";
import { analyzeAiTraceChunk, mergeAiTraceChunkOutputs } from "@/lib/services/review/aitrace.service";
import {
  chunkReferenceListByLanguageForVerify,
  extractReferences,
  sortReferenceVerificationRowsById,
  verifyReferenceBatch,
  type ReferenceVerificationRow,
} from "@/lib/services/review/reference.service";
import { buildAiTraceChunksFromMarkdown } from "@/lib/review/aitrace-markdown-chunks";
import type { ReviewResult } from "@/lib/types/review";
import type { ReviewStageEntry } from "@/lib/types/review";
import { resolveEnabledAgents } from "@/lib/review/planOptions";
import { loadEngineBaselineFromDisk } from "@/lib/services/review/format-review-config";

const SKIPPED = { skipped: true as const };

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

/**
 * Trigger Worker 不使用 Next `unstable_cache`；优先直读 Storage，失败时回退本地默认文件便于本地跑任务。
 */
async function loadPromptsConfig(): Promise<PromptsConfig> {
  try {
    return await getPromptsDirect();
  } catch (e) {
    console.warn(
      "[orchestrate-review] getPromptsDirect failed, falling back to bundled prompts.default.json",
      e
    );
    return promptsSchema.parse(promptsDefaultJson);
  }
}

export type GenericLlmBatchPayload = {
  action: string;
  dataBatch: unknown[];
  context: ReviewAnalyzeContext;
};

/** 通用 LLM 批处理子任务（可复用于其他批量调 LLM 场景） */
export const genericLlmBatchTask = task({
  id: "generic-llm-batch-task",
  queue: {
    name: "llm-batch-queue",
    concurrencyLimit: QUEUE_LIMITS.LLM_BATCH_CONCURRENCY,
  },
  run: async (payload: GenericLlmBatchPayload) => {
    if (payload.action === "verify_references") {
      return await verifyReferenceBatch(payload.dataBatch, payload.context);
    }
    if (payload.action === "aitrace_chunk") {
      const chunk = payload.dataBatch[0];
      if (typeof chunk !== "string") {
        throw new Error("aitrace_chunk: dataBatch[0] must be a string (chunk text)");
      }
      const at = payload.context.aiTrace;
      if (!at) {
        throw new Error("aitrace_chunk: context.aiTrace is required");
      }
      return await analyzeAiTraceChunk(chunk, at);
    }
    if (payload.action === "format_local_chunk") {
      const chunk = payload.dataBatch[0];
      if (typeof chunk !== "string") {
        throw new Error("format_local_chunk: dataBatch[0] must be a string (chunk text)");
      }
      const fr = payload.context.formatReview;
      if (!fr) {
        throw new Error("format_local_chunk: context.formatReview is required");
      }
      return await analyzeFormatLocalChunk(chunk, fr);
    }
    throw new Error(`Unknown batch action: ${payload.action}`);
  },
});

async function runAgent<T>(
  reviewId: number,
  agent: ReviewStageEntry["agent"],
  serviceFn: () => Promise<T>,
  opts?: { runningLog?: string }
): Promise<{ agent: ReviewStageEntry["agent"]; ok: true; value: T } | { agent: ReviewStageEntry["agent"]; ok: false; error: string }> {
  try {
    await reviewAdminDAL.updateStageStatus(reviewId, agent, "running", opts?.runningLog);
    const value = await serviceFn();
    await reviewAdminDAL.updateStageStatus(reviewId, agent, "done");
    return { agent, ok: true, value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await reviewAdminDAL.updateStageStatus(reviewId, agent, "failed", msg);
    return { agent, ok: false, error: msg };
  }
}

function skippedAgent<T>(agent: ReviewStageEntry["agent"]): { agent: typeof agent; ok: true; value: T } {
  return { agent, ok: true, value: SKIPPED as unknown as T };
}

export const orchestrateReview = task({
  id: "orchestrate-review",
  queue: {
    name: "main-review-queue",
    concurrencyLimit: QUEUE_LIMITS.MAIN_REVIEW_CONCURRENCY,
  },
  run: async (payload: { reviewId: number }) => {
    const { reviewId } = payload;
    try {
      const review = await reviewAdminDAL.getReviewById(reviewId);
      if (!review) {
        console.warn("[orchestrate-review] review not found", reviewId);
        return;
      }
      if (review.status !== "processing") {
        console.warn("[orchestrate-review] skip non-processing review", reviewId, review.status);
        return;
      }

      const fileBuffer = await storageDAL.downloadReviewPdf(review.file_url);
      const hybrid = await parseHybridDocx(fileBuffer);

      /** 以 `stages` 的 skipped 为准（与 start_review_and_deduct 一致），避免仅依赖 plan_options 列未带上。 */
      const plan = resolveEnabledAgents(review.stages, review.plan_options);

      const promptsConfig = await loadPromptsConfig();

      const ctx: ReviewAnalyzeContext = { domain: review.domain };

      if (plan.logic) {
        const logicP1 = promptsConfig.logic_review_pass1;
        const logicP2 = promptsConfig.logic_review_pass2;
        if (!logicP1?.templates?.zh || !logicP2?.templates?.zh) {
          throw new Error(
            "prompts config missing logic_review_pass1 or logic_review_pass2 (templates.zh)"
          );
        }
        const modelConfig = logicP1.model_config ?? { temperature: 0.3, model: "gemini-1.5-pro" };
        const pass1System = interpolateTemplate(logicP1.templates.zh, {
          domain: review.domain ?? "学术论文",
        });
        ctx.logicReview = {
          modelConfig,
          pass1SystemPrompt: pass1System,
          pass2TemplateRaw: logicP2.templates.zh,
        };
      }

      if (plan.aitrace) {
        const aiTraceCfg = promptsConfig.ai_trace_system;
        if (!aiTraceCfg?.templates?.zh) {
          throw new Error("prompts config missing ai_trace_system (templates.zh)");
        }
        const aiTraceModelConfig = aiTraceCfg.model_config ?? {
          temperature: 0.2,
          model: "google/gemini-3.1-pro-preview",
        };
        ctx.aiTrace = {
          modelConfig: aiTraceModelConfig,
          promptTemplate: aiTraceCfg.templates.zh,
        };
      }

      let runLocalChunksFn: RunFormatLocalChunksFn | undefined;
      let referenceVerifyBatchSize = 10;
      if (plan.reference) {
        const refExtractCfg = promptsConfig.reference_extract;
        const refVerifyCfg = promptsConfig.reference_verification;
        if (!refExtractCfg?.templates?.zh) {
          throw new Error("prompts config missing reference_extract (templates.zh)");
        }
        if (!refVerifyCfg?.templates?.zh) {
          throw new Error("prompts config missing reference_verification (templates.zh)");
        }
        const referenceExtractModelConfig = refExtractCfg.model_config ?? {
          temperature: 0.15,
          model: "google/gemini-3.1-flash-lite-preview",
        };
        const referenceVerifyModelConfig = refVerifyCfg.model_config ?? {
          temperature: 0.1,
          model: "openai/gpt-4o-mini",
          model_zh: "openai/gpt-4o-mini:online",
        };
        referenceVerifyBatchSize = refVerifyCfg.verify_batch_size ?? 10;
        ctx.referenceExtract = {
          modelConfig: referenceExtractModelConfig,
          promptTemplate: refExtractCfg.templates.zh,
        };
        ctx.referenceVerify = {
          modelConfig: referenceVerifyModelConfig,
          promptTemplate: refVerifyCfg.templates.zh,
          batchSize: referenceVerifyBatchSize,
        };
      }

      if (plan.format) {
        const fg = typeof review.format_guidelines === "string" ? review.format_guidelines.trim() : "";
        if (!fg) {
          throw new Error("[orchestrate-review] format agent enabled but format_guidelines is empty");
        }
        const fmtGlobal = promptsConfig.format_semantic_global_system;
        const fmtLocal = promptsConfig.format_semantic_local_system;
        const fmtExtract = promptsConfig.format_physical_spec_extract;
        if (!fmtGlobal?.templates?.zh) {
          throw new Error("prompts config missing format_semantic_global_system (templates.zh)");
        }
        if (!fmtLocal?.templates?.zh) {
          throw new Error("prompts config missing format_semantic_local_system (templates.zh)");
        }
        if (!fmtExtract?.templates?.zh) {
          throw new Error("prompts config missing format_physical_spec_extract (templates.zh)");
        }
        const semanticGlobalMc = fmtGlobal.model_config ?? {
          temperature: 0.25,
          model: "google/gemini-3.1-pro-preview",
        };
        const semanticLocalMc = fmtLocal.model_config ?? {
          temperature: 0.25,
          model: "google/gemini-3.1-flash-lite-preview",
        };
        const extractMc = fmtExtract.model_config ?? {
          temperature: 0.1,
          model: "google/gemini-3.1-flash-lite-preview",
        };
        ctx.formatReview = {
          formatGuidelines: fg,
          semantic: {
            globalModelConfig: {
              model: semanticGlobalMc.model,
              temperature: semanticGlobalMc.temperature,
            },
            localModelConfig: {
              model: semanticLocalMc.model,
              temperature: semanticLocalMc.temperature,
            },
            globalPromptTemplate: fmtGlobal.templates.zh,
            localPromptTemplate: fmtLocal.templates.zh,
          },
          extract: {
            modelConfig: { model: extractMc.model, temperature: extractMc.temperature },
            promptTemplate: fmtExtract.templates.zh,
          },
          engineBaseline: loadEngineBaselineFromDisk(),
        };

        runLocalChunksFn = async (chunks) => {
          const results: FormatLocalSemanticResult[] = [];
          for (let i = 0; i < chunks.length; i += QUEUE_LIMITS.LLM_BATCH_CONCURRENCY) {
            const wave = chunks.slice(i, i + QUEUE_LIMITS.LLM_BATCH_CONCURRENCY);
            const batchResult = await genericLlmBatchTask.batchTriggerAndWait(
              wave.map((chunk) => ({
                payload: {
                  action: "format_local_chunk",
                  dataBatch: [chunk],
                  context: ctx,
                } satisfies GenericLlmBatchPayload,
              }))
            );
            for (const run of batchResult.runs) {
              results.push(
                run.ok && run.output != null
                  ? (run.output as FormatLocalSemanticResult)
                  : { issues: [] }
              );
            }
          }
          return results;
        };
      }

      const formatRes = plan.format
        ? await runAgent(
            reviewId,
            "format",
            () => analyzeFormat(hybrid.markdown, hybrid.styleAst, "text", ctx, hybrid.documentSetup, hybrid.headerFooterAst, runLocalChunksFn),
            { runningLog: "正在对照格式说明进行语义与版式分析…" }
          )
        : skippedAgent("format");

      const logicRes = plan.logic
        ? await runAgent(
            reviewId,
            "logic",
            () => analyzeLogic(hybrid.markdown, "text", ctx, { docxImages: hybrid.images }),
            { runningLog: "正在通读全文并检测论证与结构问题…" }
          )
        : skippedAgent("logic");

      const aitraceRes = plan.aitrace
        ? await runAgent(reviewId, "aitrace", async () => {
            const tAi0 = performance.now();
            const chunks = buildAiTraceChunksFromMarkdown(hybrid.markdown);
            if (chunks.length === 0) {
              return {
                issues: [] as const,
                observability: { duration_ms: Math.round(performance.now() - tAi0) },
              };
            }
            const total = chunks.length;
            const outputs: unknown[] = [];
            let done = 0;

            await reviewAdminDAL.updateStageStatus(
              reviewId,
              "aitrace",
              "running",
              "约 0% · 正并行检测 AI 痕迹…"
            );

            for (let i = 0; i < chunks.length; i += QUEUE_LIMITS.LLM_BATCH_CONCURRENCY) {
              const wave = chunks.slice(i, i + QUEUE_LIMITS.LLM_BATCH_CONCURRENCY);
              const batchResult = await genericLlmBatchTask.batchTriggerAndWait(
                wave.map((chunk) => ({
                  payload: {
                    action: "aitrace_chunk",
                    dataBatch: [chunk],
                    context: ctx,
                  } satisfies GenericLlmBatchPayload,
                }))
              );
              for (const run of batchResult.runs) {
                if (run.ok && "output" in run && run.output != null) {
                  outputs.push(run.output);
                }
              }
              done += wave.length;
              const pct = Math.min(100, Math.round((done / total) * 100));
              await reviewAdminDAL.updateStageStatus(
                reviewId,
                "aitrace",
                "running",
                `约 ${pct}% · 正并行检测 AI 痕迹…`
              );
            }
            const merged = mergeAiTraceChunkOutputs(outputs);
            return {
              ...merged,
              observability: { duration_ms: Math.round(performance.now() - tAi0) },
            };
          })
        : skippedAgent("aitrace");

      const refRes = plan.reference
        ? await runAgent(
            reviewId,
            "reference",
            async () => {
              const tRef0 = performance.now();
              await reviewAdminDAL.updateStageStatus(
                reviewId,
                "reference",
                "running",
                "正在从正文识别参考文献题录…"
              );
              const refListRaw = await extractReferences(hybrid.markdown, ctx);
              const refList = Array.isArray(refListRaw) ? refListRaw : [];
              const totalRefs = refList.length;

              const wc = review.word_count ?? 0;
              const maxRefCount = await getMaxReferenceCountForWordsDirect(wc);
              if (maxRefCount !== null && totalRefs > maxRefCount) {
                throw new Error(
                  `参考文献条目数（${totalRefs} 条）超出当前字数（约 ${wc} 字）` +
                    `所支持的核查上限（${maxRefCount} 条），参考文献核查已终止。` +
                    `如需核查更多条目，请选择更高字数档位的论文。`
                );
              }

              const refChunks = chunkReferenceListByLanguageForVerify(
                refList,
                referenceVerifyBatchSize
              );

              if (refChunks.length === 0) {
                await reviewAdminDAL.updateStageStatus(
                  reviewId,
                  "reference",
                  "running",
                  totalRefs === 0
                    ? "未识别到须核查的参考文献条目"
                    : "未形成核查批次（条目异常或为空）"
                );
                return {
                  rows: [] as ReferenceVerificationRow[],
                  observability: { duration_ms: Math.round(performance.now() - tRef0) },
                };
              }

              await reviewAdminDAL.updateStageStatus(
                reviewId,
                "reference",
                "running",
                `共 ${totalRefs} 条参考文献，分 ${refChunks.length} 批逐批核查（含网络检索，可能较慢）`
              );

              const merged: ReferenceVerificationRow[] = [];
              for (let i = 0; i < refChunks.length; i++) {
                const dataBatch = refChunks[i]!;
                await reviewAdminDAL.updateStageStatus(
                  reviewId,
                  "reference",
                  "running",
                  `已核查 ${merged.length}/${totalRefs} 条 · 第 ${i + 1}/${refChunks.length} 批处理中`
                );
                const batchResult = await genericLlmBatchTask.batchTriggerAndWait([
                  {
                    payload: {
                      action: "verify_references",
                      dataBatch,
                      context: ctx,
                    } satisfies GenericLlmBatchPayload,
                  },
                ]);
                for (const run of batchResult.runs) {
                  if (run.ok && Array.isArray(run.output)) {
                    merged.push(...(run.output as ReferenceVerificationRow[]));
                  }
                }
              }

              return {
                rows: sortReferenceVerificationRowsById(merged),
                observability: { duration_ms: Math.round(performance.now() - tRef0) },
              };
            },
            { runningLog: "正在准备参考文献分析…" }
          )
        : skippedAgent("reference");

      const finalResult: ReviewResult = {
        format_result: formatRes.ok ? formatRes.value : { error: formatRes.error },
        logic_result: logicRes.ok ? logicRes.value : { error: logicRes.error },
        aitrace_result: aitraceRes.ok ? aitraceRes.value : { error: aitraceRes.error },
        reference_result: refRes.ok ? refRes.value : { error: refRes.error },
      };

      // ── 退款逻辑：在 completeReview 之前按失败维度处理退款 ──────────────────────
      type AgentKey = "format" | "logic" | "aitrace" | "reference";
      const agentResults: Array<{ agent: AgentKey; ok: boolean }> = [
        { agent: "format",    ok: !plan.format    || formatRes.ok },
        { agent: "logic",     ok: !plan.logic     || logicRes.ok },
        { agent: "aitrace",   ok: !plan.aitrace   || aitraceRes.ok },
        { agent: "reference", ok: !plan.reference || refRes.ok },
      ];

      // 已启用且失败的 agent 列表
      const enabledFailedAgents = agentResults.filter(
        ({ agent, ok }) => plan[agent] && !ok
      );

      // 所有已启用的 agent 全部失败 → 全额退款，重置为 pending，不 complete
      const allEnabledAgents = (["format", "logic", "aitrace", "reference"] as AgentKey[]).filter(
        (a) => plan[a]
      );
      const allFailed =
        allEnabledAgents.length > 0 &&
        enabledFailedAgents.length === allEnabledAgents.length;

      if (allFailed) {
        console.warn("[orchestrate-review] all enabled agents failed, issuing full refund", reviewId);
        await reviewAdminDAL.fullRefundProcessingReview(reviewId, "all_enabled_agents_failed");
        // 任务已重置为 pending，不再调用 completeReview
        return;
      }

      // 部分失败 → 逐模块退款，然后照常 complete
      for (const { agent } of enabledFailedAgents) {
        try {
          await reviewAdminDAL.partialRefundReviewStage(reviewId, agent, "agent_failed");
        } catch (refundErr) {
          // 退款失败不应阻断 complete（已打日志于 DAL 层）
          console.error(`[orchestrate-review] partial refund failed for ${agent}`, reviewId, refundErr);
        }
      }
      // ── 退款逻辑结束 ──────────────────────────────────────────────────────────────

      await reviewAdminDAL.completeReview(reviewId, finalResult);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[orchestrate-review] failed", reviewId, msg);

      // 整体崩溃时先全额退款，再挂起建工单（status=needs_manual_review）
      try {
        await reviewAdminDAL.fullRefundProcessingReview(reviewId, "orchestration_error");
      } catch (refundErr) {
        // 退款失败可能是 review 已不处于 processing（重试等场景），打日志但不影响后续挂起
        console.error("[orchestrate-review] fullRefund on crash failed", reviewId, refundErr);
      }
      await reviewAdminDAL.suspendToManualReview(reviewId, msg || "Unknown orchestration error");
    }
  },
});
