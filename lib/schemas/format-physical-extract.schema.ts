import { z } from "zod";

/**
 * 页边距必须用**整数毫米**（禁止厘米小数，避免部分模型在 JSON 里无限展开尾零直到 MAX_TOKENS）。
 * 例：3.5cm → 35；2cm → 20。
 */
const marginMmInSpec = z
  .number()
  .int()
  .min(0)
  .max(200)
  .describe("整数毫米 mm，如 35 表示 3.5cm；勿写小数");

/** 字号、行距、缩进等磅值 */
const ptInSpec = z
  .number()
  .finite()
  .min(0)
  .max(200)
  .describe("磅（pt），普通十进制小数，如 12、10.5");

/** 多倍行距 */
const lineMultipleInSpec = z
  .number()
  .finite()
  .min(0.5)
  .max(5)
  .describe("倍数，如 1.5、2");

/** 段前/段后（行） */
const linesInSpec = z
  .number()
  .finite()
  .min(0)
  .max(50)
  .describe("行数，如 0.5、1");

/** 首行缩进字符数 */
const indentCharsInSpec = z
  .number()
  .finite()
  .min(0)
  .max(20)
  .describe("字符数，如 2");

/**
 * 基础物理样式 Schema
 * 涵盖：中英文字体、字号、加粗、对齐、行距、段前段后间距、首行缩进
 */
const PhysicalStyleSchema = z.object({
  font_zh: z.string().optional().describe("中文字体，如 '宋体', '黑体', '仿宋' 等"),
  font_en: z.string().optional().describe("西文字体，如 'Times New Roman', 'Arial' 等"),
  size_pt: ptInSpec.optional().describe("字号（磅值），如小四对应12，小三对应15"),
  bold: z.boolean().optional().describe("是否加粗"),
  alignment: z.enum(["left", "center", "right", "justify"]).optional().describe("段落对齐方式"),
  line_spacing_pt: ptInSpec.optional().describe("行距（固定值/磅）"),
  line_spacing_multiple: lineMultipleInSpec.optional().describe("多倍行距，如 1.25, 1.5"),
  space_before_pt: ptInSpec.optional().describe("段前间距（磅）。若规范原文为“行”请留空并填入 space_before_lines"),
  space_after_pt: ptInSpec.optional().describe("段后间距（磅）。若规范原文为“行”请留空并填入 space_after_lines"),
  space_before_lines: linesInSpec.optional().describe("段前间距（行），如 0.5, 1"),
  space_after_lines: linesInSpec.optional().describe("段后间距（行），如 0.5, 1"),
  indent_first_line_chars: indentCharsInSpec.optional().describe("首行缩进（字符数），如 2"),
  indent_first_line_pt: ptInSpec.optional().describe("首行缩进（磅值），如 0.8cm 约等于 22.7pt"),
});

/** 
 * NL→JSON 抽取层；与引擎 IR 分离，经 compile 再消费 
 * 版本 2: 扩展了中英文字体区分、段间距、缩进、页面设置及更多上下文（如参考文献、脚注）
 */
export const formatPhysicalExtractSchema = z.object({
  schema_version: z.literal("2"),
  
  /** 页面设置（如从 <w:sectPr><w:pgMar> 提取） */
  page_setup: z
    .object({
      margin_top_mm: marginMmInSpec.optional(),
      margin_bottom_mm: marginMmInSpec.optional(),
      margin_left_mm: marginMmInSpec.optional(),
      margin_right_mm: marginMmInSpec.optional(),
    })
    .optional()
    .describe("页面边距：四边均为整数毫米（mm），由规范中的厘米×10 口算取整即可，勿输出厘米浮点数"),

  /** 标题规则 (1-6级) */
  headings: z
    .array(
      PhysicalStyleSchema.extend({
        level: z.number().int().min(1).max(6).describe("标题级别 (1-6)"),
      })
    )
    .default([]),
    
  /** 正文主体规则 */
  body: PhysicalStyleSchema.optional().describe("正文段落通用格式"),
  
  /** 图表题注规则 */
  caption: PhysicalStyleSchema.optional().describe("图注、表注格式"),
  
  /** 参考文献列表正文规则 */
  references: PhysicalStyleSchema.optional().describe("参考文献列表正文格式"),
  
  /** 脚注规则 */
  footnotes: PhysicalStyleSchema.optional().describe("脚注格式"),

  /** 页眉格式（字体、字号、对齐等） */
  header: PhysicalStyleSchema.optional().describe("页眉格式"),

  /** 页脚格式（字体、字号、对齐等） */
  footer: PhysicalStyleSchema.optional().describe("页脚格式"),

  /** 页码格式（对齐、字体、字号）；复用 PhysicalStyleSchema 保持 font_zh/font_en 分离与 alignment 枚举一致 */
  page_number: PhysicalStyleSchema.optional().describe("页码格式（对齐、字体、字号）"),

  /** 无法结构化为上述物理规则的要求（由大模型填入，供人工排查或直接忽略） */
  notes_unenforceable: z.array(z.string()).optional().describe("属于格式要求，但无法用上述字段表达的物理规则"),
});

export type FormatPhysicalExtract = z.infer<typeof formatPhysicalExtractSchema>;

