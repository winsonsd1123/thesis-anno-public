import { z } from "zod";

/** 与学校无关的引擎基线：样式 ID 模式、容差 */
export const formatEngineBaselineSchema = z.object({
  version: z.string(),
  heading_style_patterns: z.record(z.string(), z.array(z.string())),
  size_tolerance_pt: z.number().optional(),
  /**
   * 标题字号比对容差（pt）。Word 内置标题与规范「三号/小三」等换算常不一致，可与正文共用 size_tolerance_pt 时过严。
   * 仅用于标题规则的大小比对，不用于 inferHeadingLevelByFormat（避免把正文误判为标题）。
   */
  heading_size_tolerance_pt: z.number().optional(),
  /** 段落样式 ID 若包含任一子串，则不套用 body-default（封面 Title、题注等） */
  body_rule_skip_style_id_substrings: z.array(z.string()).optional(),
  /**
   * 当段落字号比 body 规则期望字号大出该值（pt）以上时，跳过 body 规则（避免封面大标题被当正文）
   */
  body_rule_oversize_skip_delta_pt: z.number().optional(),
  /** 段前/段后/固定行距（磅）比对容差 */
  spacing_tolerance_pt: z.number().optional(),
  /** 多倍行距比对容差（如 0.07 表示 ±0.07） */
  line_spacing_multiple_tolerance: z.number().optional(),
  /** 段前/段后（行）比对容差 */
  spacing_lines_tolerance: z.number().optional(),
  /** 首行缩进（字符）比对容差 */
  indent_first_line_chars_tolerance: z.number().optional(),
  /** 首行缩进（磅）比对容差 */
  indent_first_line_pt_tolerance: z.number().optional(),
});

export type FormatEngineBaseline = z.infer<typeof formatEngineBaselineSchema>;
