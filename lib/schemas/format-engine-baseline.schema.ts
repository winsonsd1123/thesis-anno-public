import { z } from "zod";

/** 与学校无关的引擎基线：样式 ID 模式、容差 */
export const formatEngineBaselineSchema = z.object({
  version: z.string(),
  heading_style_patterns: z.record(z.string(), z.array(z.string())),
  size_tolerance_pt: z.number().optional(),
  /** 段落样式 ID 若包含任一子串，则不套用 body-default（封面 Title、题注等） */
  body_rule_skip_style_id_substrings: z.array(z.string()).optional(),
  /**
   * 当段落字号比 body 规则期望字号大出该值（pt）以上时，跳过 body 规则（避免封面大标题被当正文）
   */
  body_rule_oversize_skip_delta_pt: z.number().optional(),
});

export type FormatEngineBaseline = z.infer<typeof formatEngineBaselineSchema>;
