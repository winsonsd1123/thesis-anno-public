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
