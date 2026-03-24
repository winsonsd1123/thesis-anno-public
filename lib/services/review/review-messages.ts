import type { ModelMessage } from "ai";
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
