/**
 * Hybrid DOCX 解析（Mammoth Markdown + OOXML 样式 AST）输出类型。
 * 供 orchestrate-review 在 DOCX 迁移完成后，于调用 LLM 前统一注入审阅管线。
 */

/** 段落内单个 run（连续同格式文本片段） */
export type RunSpan = {
  text: string;
  font?: string;
  size_pt?: number;
  bold?: boolean;
  italic?: boolean;
};

/** 段落所在的文档上下文 */
export type ParagraphContext = "body" | "table_cell" | "caption";

/** 段落级样式节点（用于规则引擎 quote_text 与物理排版比对） */
export type DocxStyleAstNode = {
  /** 段落内拼接后的纯文本（供定位引用） */
  text: string;
  /** dominant run（文本最长的 run）的字体；向后兼容 */
  font?: string;
  /** dominant run 的字号（磅） */
  size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  /** w:pStyle 解析出的样式 ID */
  paragraphStyleId?: string;
  characterStyleId?: string;
  /** 段落内所有 run 的逐 run 样式；空文本 run 已过滤 */
  runs?: RunSpan[];
  /** 段落所在上下文：body（默认）、table_cell、caption */
  context?: ParagraphContext;
};

export type MammothMessage = {
  type: string;
  message?: string;
};

/** Sharp 压缩后的单张图，供多模态消息与 AI SDK `ImagePart` 对齐 */
export type DocxCompressedImagePart = {
  /** 文档内顺序（从 1 起，与 Markdown 占位「图N」一致） */
  order: number;
  mediaType: string;
  dataBase64: string;
};

/**
 * 统一解析层输出：Markdown 主干 + 样式侧枝。
 */
export type HybridDocxParseResult = {
  markdown: string;
  styleAst: DocxStyleAstNode[];
  mammothMessages: MammothMessage[];
  /** 压缩后的嵌入图（Markdown 中为 `![图N]()` 占位，不含 data URI） */
  images: DocxCompressedImagePart[];
  /** 超过数量上限被丢弃的图片数 */
  imagesSkipped: number;
};
