import mammoth from "mammoth";
import type { HybridDocxParseResult, MammothMessage } from "@/lib/types/docx-hybrid";
import {
  createDocxImageConvertImage,
  createDocxImagePipelineState,
} from "./docx-image-pipeline";
import { readDocxXmlParts } from "./docx-ooxml-zip";
import { buildDocxStyleAst } from "./docx-style-ast";
import {
  extractMathFragments,
  attachMathToStyleAst,
  appendMathToMarkdown,
} from "./docx-math-extractor";

/**
 * Mammoth 会对部分标点加反斜杠，避免被当成 Markdown 列表/强调/链接语法。
 * 送给 LLM 审阅时按近纯文本呈现，去掉这些转义以减少「误用反斜杠」类假阳性。
 */
export function stripMammothMarkdownEscapes(markdown: string): string {
  return markdown.replace(/\\([.*_()[\]])/g, "$1");
}

/**
 * 剥离 Mammoth 生成的图片占位符（`![图N]()`、`![图N（读取失败）]()` 等所有 alt 形式）。
 * 仅用于格式审查轨：格式审查 LLM 看不到图片内容，占位符插入句子中间只会造成文本流断裂误报。
 * 逻辑审查轨使用原始 markdown + 图文交织，不应调用此函数。
 */
export function stripDocxImagePlaceholders(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\(\)/g, "");
}

/**
 * 统一解析层：Mammoth Markdown 主干 + OOXML 样式 AST。
 * 供 `orchestrate-review` 在 DOCX 迁移完成后，于调用 LLM 前注入审阅管线。
 */
export async function parseHybridDocx(buffer: Buffer): Promise<HybridDocxParseResult> {
  const imageState = createDocxImagePipelineState();
  const convertImage = createDocxImageConvertImage(imageState);

  const [mdRes, xmlRes] = await Promise.allSettled([
    mammoth.convertToMarkdown({ buffer }, { convertImage }),
    readDocxXmlParts(buffer),
  ]);

  if (mdRes.status === "rejected") {
    const reason = mdRes.reason instanceof Error ? mdRes.reason.message : String(mdRes.reason);
    throw new Error(`HYBRID_DOCX_MARKDOWN: ${reason}`);
  }
  if (xmlRes.status === "rejected") {
    const reason = xmlRes.reason instanceof Error ? xmlRes.reason.message : String(xmlRes.reason);
    throw new Error(`HYBRID_DOCX_STYLE_XML: ${reason}`);
  }

  const markdown = stripMammothMarkdownEscapes(mdRes.value.value);
  const messages = mdRes.value.messages;

  const { documentXml, stylesXml, headerXmls, footerXmls } = xmlRes.value;

  let styleAst;
  let headerFooterAst;
  let documentSetup;
  try {
    const result = buildDocxStyleAst(documentXml, stylesXml, headerXmls, footerXmls);
    styleAst = result.nodes;
    headerFooterAst = result.headerFooterNodes;
    documentSetup = result.setup;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`HYBRID_DOCX_STYLE_AST: ${msg}`);
  }

  let finalMarkdown = markdown;
  let mathCount = 0;

  try {
    const mathFragments = extractMathFragments(documentXml);
    mathCount = mathFragments.reduce((n, f) => n + f.latex.length, 0);

    if (mathFragments.length > 0) {
      attachMathToStyleAst(styleAst, mathFragments);
      finalMarkdown = appendMathToMarkdown(markdown, mathFragments);
    }
  } catch (e) {
    console.warn("[parseHybridDocx] math extraction failed, continuing without formulas:", e);
  }

  return {
    markdown: finalMarkdown,
    styleAst,
    mammothMessages: (messages ?? []) as MammothMessage[],
    images: imageState.images,
    imagesSkipped: imageState.imagesSkipped,
    headerFooterAst,
    documentSetup,
    mathCount,
  };
}
