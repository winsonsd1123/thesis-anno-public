import { z } from "zod";

/** NL→JSON 抽取层；与引擎 IR 分离，经 compile 再消费 */
export const formatPhysicalExtractSchema = z.object({
  schema_version: z.literal("1"),
  headings: z
    .array(
      z.object({
        level: z.number().int().min(1).max(6),
        font: z.string().optional(),
        size_pt: z.number().optional(),
        bold: z.boolean().optional(),
        line_spacing_pt: z.number().optional(),
      })
    )
    .default([]),
  body: z
    .object({
      font: z.string().optional(),
      size_pt: z.number().optional(),
      line_spacing_pt: z.number().optional(),
    })
    .optional(),
  /** 图注/表注统一格式（多数学校相同） */
  caption: z
    .object({
      font: z.string().optional(),
      size_pt: z.number().optional(),
    })
    .optional(),
  notes_unenforceable: z.array(z.string()).optional(),
});

export type FormatPhysicalExtract = z.infer<typeof formatPhysicalExtractSchema>;
