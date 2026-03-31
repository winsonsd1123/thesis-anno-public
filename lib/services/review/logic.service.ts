import { z } from "zod";
import { generateObject, zodSchema } from "ai";
import { getLLMModel } from "@/lib/integrations/openrouter";
import type { DocxCompressedImagePart } from "@/lib/types/docx-hybrid";
import type { ReviewAnalyzeContext, ReviewContentType } from "./format.service";
import { buildDocxInterleavedMessages, buildReviewMessages } from "./review-messages";
import { ReviewEngineError } from "./review-errors";

const logicIssueSchema = z.object({
  /**
   * 问题在 Markdown 中的定位锚点：最近上级标题路径（如「第 2 章 相关工作」「2.3 实验设置」），
   * 勿使用 PDF 页码；若仅有章名可只写该章标题。
   */
  section_heading: z.string(),
  quote_text: z.string(),
  issue_type: z.enum([
    "structural_flaw",
    "logical_leap",
    "shallow_analysis",
    "contradiction",
    "unsupported_claim",
  ]),
  severity: z.enum(["High", "Medium", "Low"]),
  analysis: z.string(),
  suggestion: z.string(),
});

export type LogicIssue = z.infer<typeof logicIssueSchema>;

const overallAssessmentSchema = z.object({
  research_value: z.string(),
  methodology_fitness: z.string(),
  argumentation_completeness: z.string(),
  overall_comment: z.string(),
});

export type LogicOverallAssessment = z.infer<typeof overallAssessmentSchema>;

const SEVERITY_ORDER: Record<LogicIssue["severity"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/**
 * 合并 Pass1+Pass2 后统一排序：先按严重程度（High→Medium→Low），再按 section_heading 字典序稳定排列。
 */
export function sortLogicIssues(issues: LogicIssue[]): LogicIssue[] {
  return [...issues].sort((a, b) => {
    const bySev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySev !== 0) return bySev;
    return a.section_heading.localeCompare(b.section_heading, "zh-Hans-CN");
  });
}

/** Pass1 输出：含 overall_assessment + issues */
export const LogicPass1ResultSchema = z.object({
  overall_assessment: overallAssessmentSchema,
  issues: z.array(logicIssueSchema),
});

/** Pass2 输出：仅 issues（补漏） */
export const LogicResultSchema = z.object({
  issues: z.array(logicIssueSchema),
});

/** LLM 结构化输出形状（不含观测字段） */
export type LogicLlmObject = z.infer<typeof LogicResultSchema>;

/** Pass1 LLM 结构化输出 */
type LogicPass1LlmObject = z.infer<typeof LogicPass1ResultSchema>;

/** 持久化在 `reviews.result.logic_result.observability`，便于对比 Pass2 是否带来增量 */
export type LogicReviewObservability = {
  pass1_issue_count: number;
  pass2_issue_count: number;
  merged_issue_count: number;
  pass1_duration_ms: number;
  pass2_duration_ms: number;
};

export type LogicReviewResult = LogicLlmObject & {
  overall_assessment?: LogicOverallAssessment;
  observability: LogicReviewObservability;
};

function failPass(phase: string, e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new ReviewEngineError(`logic review ${phase} failed: ${msg}`, e);
}

export type AnalyzeLogicOptions = {
  /** DOCX Hybrid：Markdown 正文 + 压缩图多模态；与 PDF base64 路径互斥 */
  docxImages?: DocxCompressedImagePart[];
};

export async function analyzeLogic(
  content: string,
  contentType: ReviewContentType,
  ctx: ReviewAnalyzeContext,
  options?: AnalyzeLogicOptions
): Promise<LogicReviewResult> {
  const lr = ctx.logicReview;
  if (!lr) {
    throw new ReviewEngineError(
      "logic review: missing logicReview on context (orchestrator must inject prompts and model_config)"
    );
  }

  const model = getLLMModel(lr.modelConfig.model);
  const temperature = lr.modelConfig.temperature;
  const messages =
    options?.docxImages !== undefined
      ? buildDocxInterleavedMessages(content, options.docxImages)
      : buildReviewMessages(content, contentType);
  const pass1Schema = zodSchema(LogicPass1ResultSchema);
  const pass2Schema = zodSchema(LogicResultSchema);

  let initialDraft: LogicPass1LlmObject;
  const t0 = performance.now();
  try {
    const pass1 = await generateObject({
      model,
      temperature,
      system: lr.pass1SystemPrompt,
      messages,
      schema: pass1Schema,
    });
    initialDraft = pass1.object;
  } catch (e) {
    failPass("pass1", e);
  }
  const pass1DurationMs = Math.round(performance.now() - t0);

  const pass2System = lr.pass2TemplateRaw.replace(
    "{{initial_draft}}",
    JSON.stringify(initialDraft.issues)
  );

  let pass2Result: LogicLlmObject;
  const t1 = performance.now();
  try {
    const pass2 = await generateObject({
      model,
      temperature,
      system: pass2System,
      messages,
      schema: pass2Schema,
    });
    pass2Result = pass2.object;
  } catch (e) {
    failPass("pass2", e);
  }
  const pass2DurationMs = Math.round(performance.now() - t1);

  const mergedIssues = sortLogicIssues([...initialDraft.issues, ...pass2Result.issues]);
  const pass1Count = initialDraft.issues.length;
  const pass2Count = pass2Result.issues.length;

  const observability: LogicReviewObservability = {
    pass1_issue_count: pass1Count,
    pass2_issue_count: pass2Count,
    merged_issue_count: mergedIssues.length,
    pass1_duration_ms: pass1DurationMs,
    pass2_duration_ms: pass2DurationMs,
  };

  console.log(
    JSON.stringify({
      tag: "logic_review_pass_metrics",
      ...observability,
      pass2_incremental_ratio:
        pass1Count + pass2Count > 0 ? pass2Count / (pass1Count + pass2Count) : 0,
    })
  );

  return {
    overall_assessment: initialDraft.overall_assessment,
    issues: mergedIssues,
    observability,
  };
}
