import type { PhysicalLayoutIssue } from "@/lib/services/review/format-rules.engine";
import type { DocumentType } from "./document-type";
import type { StructuralCheckContext, StructuralRule } from "./types";
import { h1PresenceRule } from "./checks/h1-presence.rule";
import { tocPresenceRule } from "./checks/toc-presence.rule";
import { captionPresenceRule } from "./checks/caption-presence.rule";

/**
 * 全部结构完整性规则。
 * 新增规则：创建规则文件后在此追加，无需改动其他逻辑。
 */
const ALL_STRUCTURAL_RULES: StructuralRule[] = [
  h1PresenceRule,
  tocPresenceRule,
  captionPresenceRule,
];

/**
 * 按文档类型过滤并执行适用的结构规则，返回所有检测到的 issue。
 * 纯函数，确定性执行，不依赖 LLM。
 */
export function runStructuralChecks(
  ctx: StructuralCheckContext,
  docType: DocumentType,
): PhysicalLayoutIssue[] {
  return ALL_STRUCTURAL_RULES
    .filter((rule) => rule.applicableTo.includes(docType))
    .flatMap((rule) => rule.check(ctx));
}
