/**
 * 格式语义轨 Map-Reduce：Markdown 分块工具
 *
 * - extractGlobalSkeleton：提取全文标题树 + 前置区域（含第一章），供 Global Pass 做宏观结构审查
 * - splitMarkdownByChapters：按顶级标题切章，前置区域单独为首块，每章独立一块，供 Local Map 并发细查
 */

const ATX_H1 = /^# /;
const ATX_ANY = /^(#{1,6})\s+(.+)$/;

// ---------------------------------------------------------------------------
// 内部工具：找出所有 H1 行索引
// ---------------------------------------------------------------------------

function findH1Indices(lines: string[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (ATX_H1.test(lines[i]!)) indices.push(i);
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Global Pass
// ---------------------------------------------------------------------------

/**
 * 提取"全文标题目录树 + 前置区域（含第一章完整内容）"，喂给 Global Pass 大模型。
 * 前置区 = 文档开头 → 第二个 H1 之前（包含摘要、目录、第一章绪论等），不截断。
 */
export function extractGlobalSkeleton(markdown: string): string {
  const lines = markdown.split("\n");
  const h1Indices = findH1Indices(lines);

  // 1. 全文标题目录树
  const headingLines: string[] = [];
  for (const line of lines) {
    const m = line.match(ATX_ANY);
    if (m) {
      const depth = m[1]!.length;
      const indent = "  ".repeat(depth - 1);
      headingLines.push(`${indent}${line.trim()}`);
    }
  }

  // 2. 前置区域 + 第一章完整正文（第二个 H1 之前）
  const cutLine = h1Indices.length >= 2 ? h1Indices[1]! : lines.length;
  const preamble = lines.slice(0, cutLine).join("\n").trim();

  const parts: string[] = [];
  if (headingLines.length > 0) {
    parts.push(`## 全文标题目录树\n\n${headingLines.join("\n")}`);
  }
  if (preamble) {
    parts.push(`## 前置区域与第一章\n\n${preamble}`);
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Local Pass
// ---------------------------------------------------------------------------

/**
 * 按顶级标题（H1）切分 Markdown 为章节数组。
 * - 第一个 H1 之前的内容（封面、摘要、目录等）单独为 chunk[0]
 * - 每个 H1 章节各自独立为一个 chunk
 * - 若无 H1，整篇作为一个 chunk
 */
export function splitMarkdownByChapters(markdown: string): string[] {
  const lines = markdown.split("\n");
  const h1Indices = findH1Indices(lines);

  const chunks: string[] = [];

  if (h1Indices.length === 0) {
    // 无 H1：整篇作为一个 chunk
    const full = markdown.trim();
    if (full) chunks.push(full);
    return chunks;
  }

  // 前置区域（第一个 H1 之前）
  if (h1Indices[0]! > 0) {
    const preamble = lines.slice(0, h1Indices[0]).join("\n").trim();
    if (preamble) chunks.push(preamble);
  }

  // 每个 H1 章节独立一块
  for (let i = 0; i < h1Indices.length; i++) {
    const start = h1Indices[i]!;
    const end = i + 1 < h1Indices.length ? h1Indices[i + 1]! : lines.length;
    const chapterText = lines.slice(start, end).join("\n").trim();
    if (chapterText) chunks.push(chapterText);
  }

  return chunks;
}
