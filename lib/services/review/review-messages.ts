import type { ModelMessage } from "ai";
import type { DocxCompressedImagePart } from "@/lib/types/docx-hybrid";
import type { ReviewContentType } from "./format.service";

const USER_INSTRUCTION =
  "请阅读以下论文全文，按要求产出结构化 JSON（仅输出 schema 约定字段）。以下为用户上传的论文内容。";

/**
 * 供审阅引擎复用：Pass1/Pass2 共用同一组 user messages，仅切换 system 指令。
 */
export function buildReviewMessages(
  content: string,
  contentType: ReviewContentType
): ModelMessage[] {
  if (contentType === "text") {
    return [
      {
        role: "user",
        content: `${USER_INSTRUCTION}\n\n${content}`,
      },
    ];
  }

  return [
    {
      role: "user",
      content: [
        { type: "text", text: USER_INSTRUCTION },
        {
          type: "file",
          data: Buffer.from(content, "base64"),
          mediaType: "application/pdf",
          filename: "paper.pdf",
        },
      ],
    },
  ];
}

/**
 * DOCX Hybrid 解析结果：Markdown 文本 + 压缩图，组装为 AI SDK 多模态 user 消息（text + image 部件）。
 * 图片集中追加在文本末尾（旧行为，保留供降级使用）。
 */
export function buildDocxMultimodalMessages(
  markdownText: string,
  images: DocxCompressedImagePart[]
): ModelMessage[] {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mediaType?: string }
  > = [{ type: "text", text: `${USER_INSTRUCTION}\n\n${markdownText}` }];

  for (const img of images) {
    content.push({
      type: "image",
      image: img.dataBase64,
      mediaType: img.mediaType,
    });
  }

  return [{ role: "user", content }];
}

/**
 * DOCX Hybrid 图文交织消息：将 Markdown 中的 `![图N]()` 占位符替换为对应的真实图片 part，
 * 使 LLM 在阅读每段文字时能同步看到紧随其后的插图，而非将图片全部堆在末尾。
 *
 * - 仅替换格式为 `![图<纯数字>]()` 的占位符（即 docx-image-pipeline 的正常产出）；
 *   读取失败 / 超限的占位符文本原样保留，不影响文本流。
 * - images 数组中 order 与占位符 N 一一对应；若某张图未找到（被跳过）则跳过图片 part，
 *   仅去除占位符标记，避免消息中出现空 part。
 */
export function buildDocxInterleavedMessages(
  markdownText: string,
  images: DocxCompressedImagePart[]
): ModelMessage[] {
  const imageByOrder = new Map(images.map((img) => [img.order, img]));

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image"; image: string; mediaType?: string };

  const content: ContentPart[] = [];

  // 按 `![图N]()` 切割（N 为纯数字），逐段构建 content parts
  const PLACEHOLDER_RE = /!\[图(\d+)\]\(\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const fullText = `${USER_INSTRUCTION}\n\n${markdownText}`;

  while ((match = PLACEHOLDER_RE.exec(fullText)) !== null) {
    const textBefore = fullText.slice(lastIndex, match.index);
    if (textBefore) {
      content.push({ type: "text", text: textBefore });
    }

    const order = parseInt(match[1]!, 10);
    const img = imageByOrder.get(order);
    if (img) {
      content.push({ type: "image", image: img.dataBase64, mediaType: img.mediaType });
    }

    lastIndex = match.index + match[0].length;
  }

  // 剩余文本（最后一张图之后，或无图时的全文）
  const remaining = fullText.slice(lastIndex);
  if (remaining) {
    content.push({ type: "text", text: remaining });
  }

  // 兜底：若 content 为空（不应发生），退化为纯文本
  if (content.length === 0) {
    content.push({ type: "text", text: fullText });
  }

  return [{ role: "user", content }];
}
