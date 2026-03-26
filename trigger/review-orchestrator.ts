import { readFileSync } from "node:fs";
import { join } from "node:path";
import { task } from "@trigger.dev/sdk/v3";
import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { storageDAL } from "@/lib/dal/storage.dal";
import { promptsSchema } from "@/lib/schemas/config.schemas";
import type { PromptsConfig } from "@/lib/schemas/config.schemas";
import { getPromptsDirect } from "@/lib/services/config.service";
import { parseHybridDocx } from "@/lib/review/hybrid-docx-parser";
import { analyzeFormat } from "@/lib/services/review/format.service";
import type { ReviewAnalyzeContext } from "@/lib/services/review/format.service";
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
      "[orchestrate-review] getPromptsDirect failed, falling back to config/prompts.default.json",
      e
    );
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "config", "prompts.default.json"), "utf8")
    );
    return promptsSchema.parse(raw);
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
    concurrencyLimit: 5,
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
    throw new Error(`Unknown batch action: ${payload.action}`);
  },
});

async function runAgent<T>(
  reviewId: number,
  agent: ReviewStageEntry["agent"],
  serviceFn: () => Promise<T>
): Promise<{ agent: ReviewStageEntry["agent"]; ok: true; value: T } | { agent: ReviewStageEntry["agent"]; ok: false; error: string }> {
  try {
    await reviewAdminDAL.updateStageStatus(reviewId, agent, "running");
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
    concurrencyLimit: 5,
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
        const fmtSemantic = promptsConfig.format_review_system;
        const fmtExtract = promptsConfig.format_physical_spec_extract;
        if (!fmtSemantic?.templates?.zh) {
          throw new Error("prompts config missing format_review_system (templates.zh)");
        }
        if (!fmtExtract?.templates?.zh) {
          throw new Error("prompts config missing format_physical_spec_extract (templates.zh)");
        }
        const semanticMc = fmtSemantic.model_config ?? {
          temperature: 0.25,
          model: "google/gemini-3.1-pro-preview",
        };
        const extractMc = fmtExtract.model_config ?? {
          temperature: 0.1,
          model: "google/gemini-3.1-flash-lite-preview",
        };
        ctx.formatReview = {
          formatGuidelines: fg,
          semantic: {
            modelConfig: { model: semanticMc.model, temperature: semanticMc.temperature },
            promptTemplate: fmtSemantic.templates.zh,
          },
          extract: {
            modelConfig: { model: extractMc.model, temperature: extractMc.temperature },
            promptTemplate: fmtExtract.templates.zh,
          },
          engineBaseline: loadEngineBaselineFromDisk(),
        };
      }

      const [formatRes, logicRes] = await Promise.all([
        plan.format
          ? runAgent(reviewId, "format", () =>
              analyzeFormat(hybrid.markdown, hybrid.styleAst, "text", ctx)
            )
          : skippedAgent("format"),
        plan.logic
          ? runAgent(reviewId, "logic", () =>
              analyzeLogic(hybrid.markdown, "text", ctx, { docxImages: hybrid.images })
            )
          : skippedAgent("logic"),
      ]);

      const aitraceRes = plan.aitrace
        ? await runAgent(reviewId, "aitrace", async () => {
            const chunks = buildAiTraceChunksFromMarkdown(hybrid.markdown);
            if (chunks.length === 0) {
              return { issues: [] as const };
            }
            const batchResult = await genericLlmBatchTask.batchTriggerAndWait(
              chunks.map((chunk) => ({
                payload: {
                  action: "aitrace_chunk",
                  dataBatch: [chunk],
                  context: ctx,
                } satisfies GenericLlmBatchPayload,
              }))
            );
            const outputs: unknown[] = [];
            for (const run of batchResult.runs) {
              if (run.ok && "output" in run && run.output != null) {
                outputs.push(run.output);
              }
            }
            return mergeAiTraceChunkOutputs(outputs);
          })
        : skippedAgent("aitrace");

      const refRes = plan.reference
        ? await runAgent(reviewId, "reference", async () => {
            await reviewAdminDAL.updateStageStatus(reviewId, "reference", "running", "extracting references");
            const refListRaw = await extractReferences(hybrid.markdown, ctx);
            const refList = Array.isArray(refListRaw) ? refListRaw : [];

            await reviewAdminDAL.updateStageStatus(reviewId, "reference", "running", "verifying references");
            const refChunks = chunkReferenceListByLanguageForVerify(
              refList,
              referenceVerifyBatchSize
            );
            if (refChunks.length === 0) {
              return [];
            }

            const batchResult = await genericLlmBatchTask.batchTriggerAndWait(
              refChunks.map((dataBatch) => ({
                payload: {
                  action: "verify_references",
                  dataBatch,
                  context: ctx,
                } satisfies GenericLlmBatchPayload,
              }))
            );

            const runs = batchResult.runs;

            const merged = runs.flatMap((run) => {
              if (run.ok && Array.isArray(run.output)) {
                return run.output;
              }
              return [];
            }) as ReferenceVerificationRow[];

            return sortReferenceVerificationRowsById(merged);
          })
        : skippedAgent("reference");

      const finalResult: ReviewResult = {
        format_result: formatRes.ok ? formatRes.value : { error: formatRes.error },
        logic_result: logicRes.ok ? logicRes.value : { error: logicRes.error },
        aitrace_result: aitraceRes.ok ? aitraceRes.value : { error: aitraceRes.error },
        reference_result: refRes.ok ? refRes.value : { error: refRes.error },
      };

      await reviewAdminDAL.completeReview(reviewId, finalResult);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[orchestrate-review] failed", reviewId, msg);
      await reviewAdminDAL.suspendToManualReview(reviewId, msg || "Unknown orchestration error");
    }
  },
});
