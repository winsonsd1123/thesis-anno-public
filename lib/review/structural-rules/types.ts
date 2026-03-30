import type { DocxStyleAstNode } from "@/lib/types/docx-hybrid";
import type { PhysicalLayoutIssue } from "@/lib/services/review/format-rules.engine";
import type { DocumentType } from "./document-type";

export type StructuralCheckContext = {
  styleAst: DocxStyleAstNode[];
  markdown: string;
};

/**
 * 单条文档结构完整性规则。
 * - applicableTo：声明适用的文档类型，引擎按此字段门控执行。
 * - check：纯函数，无副作用，返回零或多条 PhysicalLayoutIssue。
 */
export type StructuralRule = {
  id: string;
  description: string;
  applicableTo: readonly DocumentType[];
  check: (ctx: StructuralCheckContext) => PhysicalLayoutIssue[];
};
