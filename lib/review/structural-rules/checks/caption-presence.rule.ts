import type { StructuralRule } from "../types";

/**
 * 中文学位论文：包含图或表但缺少题注。
 *
 * 触发条件（两步）：
 * 1. 文档存在图片或表格：
 *    - Markdown 中有图片占位符（`![图` 开头，由 hybrid parser 生成）；或
 *    - styleAst 中存在 context === "table_cell" 的节点（表明文档有表格）。
 * 2. styleAst 中不存在任何 context === "caption" 的节点。
 *
 * 两步均满足时报 High 级 issue；若文档无图无表则不触发（避免误报）。
 */
export const captionPresenceRule: StructuralRule = {
  id: "struct-caption-presence",
  description: "检查含图/表的文档是否包含题注",
  applicableTo: ["chinese_degree_thesis"],
  check({ styleAst, markdown }) {
    const hasImages = /!\[图/.test(markdown);
    const hasTables = styleAst.some((node) => node.context === "table_cell");

    if (!hasImages && !hasTables) return [];

    const hasCaptions = styleAst.some((node) => node.context === "caption");
    if (hasCaptions) return [];

    const subject = hasImages && hasTables ? "图片和表格" : hasImages ? "图片" : "表格";

    return [
      {
        issue_type: "physical_layout_violation",
        chapter: "文档结构",
        quote_text: "图/表题注",
        severity: "High",
        analysis: `文档包含${subject}，但未检测到任何题注（Caption）段落。学位论文中每幅图、每张表均须在其下方（或上方，按校规）附加题注，格式如「图 1-1 示意图」「表 2-1 数据汇总」。`,
        suggestion:
          "请为文档中所有图片和表格添加题注：在 Word 中右键图/表→插入题注，或手动使用「题注」样式，确保编号连续且与正文交叉引用一致。",
      },
    ];
  },
};
