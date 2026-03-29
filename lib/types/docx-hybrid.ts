/**
 * Hybrid DOCX 解析（Mammoth Markdown + OOXML 样式 AST）输出类型。
 * 供 orchestrate-review 在 DOCX 迁移完成后，于调用 LLM 前统一注入审阅管线。
 */

/** 段落内单个 run（连续同格式文本片段） */
export type RunSpan = {
  text: string;
  font_zh?: string;
  font_en?: string;
  size_pt?: number;
  bold?: boolean;
  italic?: boolean;
};

/** 段落所在的文档上下文（局部特征） */
export type ParagraphContext = "body" | "table_cell" | "caption" | "references" | "footnotes" | "header" | "footer";

/** 全局结构区段（划分文档大块区域） */
export type DocumentPartition =
  | "front_cover"
  | "abstract"
  | "toc"
  | "main_body"
  | "references"
  /** 致谢、声明等正文后的附录性内容，物理轨跳过 */
  | "end_matter";

/** 段落级样式节点（用于规则引擎 quote_text 与物理排版比对） */
export type DocxStyleAstNode = {
  /** 段落内拼接后的纯文本（供定位引用） */
  text: string;
  /** dominant run 的中文字体（eastAsia） */
  font_zh?: string;
  /** dominant run 的西文字体（ascii/hAnsi） */
  font_en?: string;
  /** dominant run 的字号（磅） */
  size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  /** w:pStyle 解析出的样式 ID */
  paragraphStyleId?: string;
  characterStyleId?: string;
  /** 从底层 w:pPr/w:outlineLvl 或样式继承中提取的大纲级别（0=1级，1=2级...） */
  outlineLevel?: number;
  /**
   * 段落级 w:spacing / w:ind（含样式链合并）。行距：固定/至少为磅值；w:lineRule=auto 时为倍数。
   * twips→pt：1pt=20twips；auto 行距：倍数=line/240。
   */
  line_spacing_pt?: number;
  line_spacing_multiple?: number;
  space_before_pt?: number;
  space_after_pt?: number;
  /** w:beforeLines / w:afterLines（1行=100单位，0.5行则为 0.5） */
  space_before_lines?: number;
  space_after_lines?: number;
  /** w:firstLineChars：1 字符 = 100 单位 */
  indent_first_line_chars?: number;
  /** w:firstLine twips 折算 */
  indent_first_line_pt?: number;
  /**
   * 段落对齐：来自 w:pPr/w:jc/@w:val（含样式链继承），小写（如 center、left、both）。
   * 用于题注推断与「居中却按正文报缩进」时的提示。
   */
  paragraph_jc?: string;
  /** 段落内所有 run 的逐 run 样式；空文本 run 已过滤 */
  runs?: RunSpan[];
  /** 段落所在上下文（局部特征） */
  context?: ParagraphContext;
  /** 段落所在的全局区段（用于硬隔离封面、目录） */
  partition?: DocumentPartition;
  /** 是否包含动态页码域（如 fldSimple[@instr=" PAGE "] 或 instrText 含 PAGE） */
  has_page_number?: boolean;
  /** 该段落中数学公式的 LaTeX 表示（由 docx-math-extractor 按文本匹配挂载） */
  math_latex?: string[];
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

/** 文档全局设置（页边距等），来自 word/document.xml 中 body 级 sectPr */
export type DocumentSetup = {
  margins?: {
    top_cm?: number;
    bottom_cm?: number;
    left_cm?: number;
    right_cm?: number;
  };
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
  /**
   * 页眉页脚段落节点，独立存放（不混入 styleAst），
   * 避免 partitionDocumentAst 对其产生错误的分区标注。
   */
  headerFooterAst: DocxStyleAstNode[];
  /** 文档全局设置（页边距），来自 body 级 sectPr/pgMar */
  documentSetup: DocumentSetup;
  /** 文档中提取到的数学公式总数 */
  mathCount: number;
};
