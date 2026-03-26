import mammoth from "mammoth";
import type { HybridDocxParseResult, MammothMessage } from "@/lib/types/docx-hybrid";
import {
  createDocxImageConvertImage,
  createDocxImagePipelineState,
} from "./docx-image-pipeline";
import { readDocxXmlParts } from "./docx-ooxml-zip";
import { buildDocxStyleAst } from "./docx-style-ast";

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

  const { value: markdown, messages } = mdRes.value;
  const { documentXml, stylesXml } = xmlRes.value;

  let styleAst;
  try {
    styleAst = buildDocxStyleAst(documentXml, stylesXml);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`HYBRID_DOCX_STYLE_AST: ${msg}`);
  }

  return {
    markdown: markdown,
    styleAst,
    mammothMessages: (messages ?? []) as MammothMessage[],
    images: imageState.images,
    imagesSkipped: imageState.imagesSkipped,
  };
}
