/**
 * 去掉 Mammoth/Word 导出的空锚点（如目录书签 `<a id="_Toc…"></a>`），避免出现在报告位置与引用中。
 * 仅移除内部为空的 `<a …></a>`，不影响带链接文字的 `<a href="…">…</a>`。
 */
export function stripEmptyHtmlAnchors(input: string): string {
  const without = input.replace(/<a\b[^>]*>\s*<\/a>/gi, "");
  return without.replace(/\s{2,}/g, " ").trim();
}
