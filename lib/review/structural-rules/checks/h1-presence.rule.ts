import type { StructuralRule } from "../types";

/**
 * 中文学位论文：缺少一级标题。
 *
 * 判据（满足任一则认为存在 H1）：
 * 1. styleAst 中存在 outlineLevel === 0 的段落（OOXML outline level 0 = 第 1 级）
 * 2. Markdown 中存在 `# ` 开头的行（ATX H1）
 *
 * 无 H1 意味着文档结构完全扁平，无法区分各章节，属于严重结构缺陷。
 */
export const h1PresenceRule: StructuralRule = {
  id: "struct-h1-presence",
  description: "检查文档是否包含至少一个一级标题（H1）",
  applicableTo: ["chinese_degree_thesis"],
  check({ styleAst, markdown }) {
    const hasH1InAst = styleAst.some(
      (node) => node.outlineLevel !== undefined && node.outlineLevel === 0,
    );
    if (hasH1InAst) return [];

    const hasH1InMarkdown = /^# .+/m.test(markdown);
    if (hasH1InMarkdown) return [];

    return [
      {
        issue_type: "physical_layout_violation",
        chapter: "文档结构",
        quote_text: "一级标题",
        severity: "High",
        analysis:
          "文档中未检测到任何一级标题（H1）。学位论文各主要章节须使用一级标题（如「第一章」「摘要」「参考文献」等），以确保文档具备清晰的层次结构。",
        suggestion:
          "请为论文的摘要、各章节及参考文献等主要部分设置一级标题，并在 Word 中应用「标题 1」样式（或对应大纲级别 1）。",
      },
    ];
  },
};
