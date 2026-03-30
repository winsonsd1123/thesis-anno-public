import type { StructuralRule } from "../types";

/**
 * 中文学位论文：缺少目录。
 *
 * 判据：styleAst 中不存在任何 partition === "toc" 的节点。
 * partitionDocumentAst 会将目录区域的段落标注为 "toc" 分区；
 * 若无此分区，则认为文档缺少目录。
 *
 * 目录是学位论文的必要结构元素，评审委员会与答辩委员会依赖目录导航全文。
 */
export const tocPresenceRule: StructuralRule = {
  id: "struct-toc-presence",
  description: "检查文档是否包含目录区段",
  applicableTo: ["chinese_degree_thesis"],
  check({ styleAst }) {
    const hasToc = styleAst.some((node) => node.partition === "toc");
    if (hasToc) return [];

    return [
      {
        issue_type: "physical_layout_violation",
        chapter: "文档结构",
        quote_text: "目录",
        severity: "High",
        analysis:
          "文档中未检测到目录区段。学位论文须在正文前设置自动生成的目录，列出各章节标题及对应页码，便于读者定位。",
        suggestion:
          "请在摘要之后、正文之前插入 Word 自动目录（引用→目录），目录须与各级标题样式联动，确保页码准确。",
      },
    ];
  },
};
