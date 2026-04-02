import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmldomDocument,
  Element as XmldomElement,
  Node as XmldomNode,
} from "@xmldom/xmldom";
import omml2mathml from "omml2mathml";
import { MathMLToLaTeX } from "mathml-to-latex";
import type { DocxStyleAstNode } from "@/lib/types/docx-hybrid";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

export type MathFragment = {
  paragraphText: string;
  latex: string[];
  display: boolean;
  /** display 公式的前一个非公式段落文本，用于 Markdown 内联定位 */
  prevText?: string;
  /**
   * 内联公式：按 OOXML 子节点顺序交织的「文字 + $LaTeX$」，用于在 Markdown 中整段替换
   * `paragraphText`（Mammoth 在公式处留空），避免公式被追加到错误行末。
   */
  textWithMath?: string;
};

/**
 * 从 document.xml 字符串中提取所有数学公式，转为 LaTeX。
 * 使用 @xmldom/xmldom 解析 DOM；
 * 0.9+ 需用 onError，对象式 errorHandler 会抛 TypeError。
 * 通过 omml2mathml + mathml-to-latex 完成 OMML→MathML→LaTeX 转换。
 */
export function extractMathFragments(documentXml: string): MathFragment[] {
  let doc: XmldomDocument;
  try {
    doc = new DOMParser({
      onError(level) {
        if (level === "warning" || level === "error") return;
      },
    }).parseFromString(documentXml, "text/xml");
  } catch {
    return [];
  }

  const paragraphs = doc.getElementsByTagNameNS(W_NS, "p");
  const results: MathFragment[] = [];
  let lastNonMathText = "";

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const mathNodes: XmldomElement[] = [];
    let isDisplay = false;

    for (let j = 0; j < p.childNodes.length; j++) {
      const child = p.childNodes[j];
      if (child.nodeType !== 1) continue;
      const el = child as XmldomElement;
      if (el.namespaceURI === M_NS && el.localName === "oMathPara") {
        isDisplay = true;
        const inner = el.getElementsByTagNameNS(M_NS, "oMath");
        for (let k = 0; k < inner.length; k++) mathNodes.push(inner[k]);
      } else if (el.namespaceURI === M_NS && el.localName === "oMath") {
        mathNodes.push(el);
      }
    }

    if (mathNodes.length === 0) {
      const textParts: string[] = [];
      collectNonMathText(p, textParts);
      const pText = textParts.join("").trim();
      if (pText) lastNonMathText = pText;
      continue;
    }

    const textParts: string[] = [];
    collectNonMathText(p, textParts);
    const paragraphText = textParts.join("");

    const latexFragments: string[] = [];
    for (const mathNode of mathNodes) {
      try {
        const mathmlEl = omml2mathml(mathNode);
        const raw = MathMLToLaTeX.convert(mathmlEl.outerHTML);
        const latex = postProcessLatex(raw);
        if (latex.trim()) latexFragments.push(latex.trim());
      } catch {
        // unconvertible formula — skip
      }
    }

    if (latexFragments.length > 0) {
      const frag: MathFragment = { paragraphText, latex: latexFragments, display: isDisplay };
      if (isDisplay && lastNonMathText) {
        frag.prevText = lastNonMathText;
      } else if (!isDisplay) {
        const twm = buildTextWithMathFromParagraph(p as XmldomElement);
        if (twm !== undefined && /\$/.test(twm)) {
          frag.textWithMath = twm;
        }
      }
      results.push(frag);
    }
  }

  return results;
}

/** w:t 文本收集，跳过 m:* 命名空间（公式）和 w:pPr/w:rPr（属性） */
function collectNonMathText(node: XmldomNode, parts: string[]): void {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType !== 1) continue;
    const el = child as XmldomElement;
    if (el.namespaceURI === M_NS) continue;
    if (el.namespaceURI === W_NS && (el.localName === "pPr" || el.localName === "rPr")) continue;
    if (el.namespaceURI === W_NS && el.localName === "t") {
      parts.push(el.textContent || "");
    } else if (el.namespaceURI === W_NS && el.localName === "tab") {
      parts.push("\t");
    } else if (el.namespaceURI === W_NS && el.localName === "br") {
      parts.push("\n");
    } else {
      collectNonMathText(el, parts);
    }
  }
}

function ommlElementToLatex(mathNode: XmldomElement): string | undefined {
  try {
    const mathmlEl = omml2mathml(mathNode);
    const raw = MathMLToLaTeX.convert(mathmlEl.outerHTML);
    const latex = postProcessLatex(raw);
    const t = latex.trim();
    return t || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 按段落子节点顺序输出「w:r 文本 + m:oMath → $...$」，供 Markdown 整段替换。
 * 任一公式转换失败则返回 undefined（回退到行末追加逻辑）。
 */
function buildTextWithMathFromParagraph(p: XmldomElement): string | undefined {
  let out = "";
  for (let i = 0; i < p.childNodes.length; i++) {
    const child = p.childNodes[i];
    if (child.nodeType !== 1) continue;
    const piece = emitParagraphSubtree(child as XmldomElement);
    if (piece === null) return undefined;
    out += piece;
  }
  return out;
}

function emitParagraphSubtree(el: XmldomElement): string | null {
  if (el.namespaceURI === W_NS && el.localName === "pPr") return "";

  if (el.namespaceURI === W_NS && el.localName === "r") {
    const parts: string[] = [];
    collectNonMathText(el, parts);
    return parts.join("");
  }

  if (el.namespaceURI === M_NS && el.localName === "oMath") {
    const latex = ommlElementToLatex(el);
    if (!latex) return null;
    return `$${latex}$`;
  }

  if (el.namespaceURI === M_NS && el.localName === "oMathPara") {
    return "";
  }

  if (el.namespaceURI === W_NS && el.localName === "hyperlink") {
    let s = "";
    for (let i = 0; i < el.childNodes.length; i++) {
      const c = el.childNodes[i];
      if (c.nodeType !== 1) continue;
      const p = emitParagraphSubtree(c as XmldomElement);
      if (p === null) return null;
      s += p;
    }
    return s;
  }

  if (el.namespaceURI === W_NS && el.localName === "sdt") {
    const content = findChildByLocalName(el, W_NS, "sdtContent");
    if (!content) return "";
    let s = "";
    for (let i = 0; i < content.childNodes.length; i++) {
      const c = content.childNodes[i];
      if (c.nodeType !== 1) continue;
      const p = emitParagraphSubtree(c as XmldomElement);
      if (p === null) return null;
      s += p;
    }
    return s;
  }

  const skipLocalNames = new Set([
    "bookmarkStart",
    "bookmarkEnd",
    "commentRangeStart",
    "commentRangeEnd",
    "proofErr",
    "customXml",
    "permStart",
    "permEnd",
    "moveFromRangeStart",
    "moveFromRangeEnd",
    "moveToRangeStart",
    "moveToRangeEnd",
  ]);
  if (el.namespaceURI === W_NS && skipLocalNames.has(el.localName)) {
    return "";
  }

  if (el.namespaceURI === W_NS) {
    let s = "";
    for (let i = 0; i < el.childNodes.length; i++) {
      const c = el.childNodes[i];
      if (c.nodeType !== 1) continue;
      const p = emitParagraphSubtree(c as XmldomElement);
      if (p === null) return null;
      s += p;
    }
    return s;
  }

  return "";
}

function findChildByLocalName(parent: XmldomElement, ns: string, local: string): XmldomElement | undefined {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType !== 1) continue;
    const e = c as XmldomElement;
    if (e.namespaceURI === ns && e.localName === local) return e;
  }
  return undefined;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** strip Markdown inline 格式标记（**、__、*、_），用于模糊匹配 */
function stripMarkdownInline(s: string): string {
  return s.replace(/(\*\*|__|[*_])/g, "");
}

/**
 * LaTeX 后处理：
 * 1. 合并 omml2mathml 拆散的连续单字母为 \text{...}
 * 2. 移除尾部公式编号（Word 制表符对齐的 (2.1) 等）
 * 3. 清理 &nbsp; HTML 实体
 * 4. 规范化 Unicode ‖ (U+2016) → \|
 */
export function postProcessLatex(latex: string): string {
  let s = latex;

  s = s.replace(/&nbsp;/g, " ");

  s = s.replace(/‖/g, "\\|");

  s = s.replace(
    /\s*\\#\s*\\left[（(].*$/,
    "",
  );

  s = s.replace(
    /(?<![a-zA-Z\\])([a-zA-Z] ){2,}[a-zA-Z](?![a-zA-Z])/g,
    (match) => {
      const merged = match.replace(/ /g, "");
      return `\\text{${merged}}`;
    },
  );

  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * 将提取到的公式按文本匹配挂到 styleAst 节点的 math_latex 字段上。
 * 返回成功匹配的数量。
 */
export function attachMathToStyleAst(
  styleAst: DocxStyleAstNode[],
  fragments: MathFragment[],
): number {
  const matched = new Set<number>();
  let count = 0;

  for (const frag of fragments) {
    const normFrag = normalizeText(frag.paragraphText);
    let bestIdx = -1;

    for (let i = 0; i < styleAst.length; i++) {
      if (matched.has(i)) continue;
      const normAst = normalizeText(styleAst[i].text);
      if (normAst === normFrag) {
        bestIdx = i;
        break;
      }
    }

    if (bestIdx === -1 && normFrag.length > 0) {
      for (let i = 0; i < styleAst.length; i++) {
        if (matched.has(i)) continue;
        const normAst = normalizeText(styleAst[i].text);
        if (normAst.includes(normFrag) || normFrag.includes(normAst)) {
          bestIdx = i;
          break;
        }
      }
    }

    if (bestIdx === -1 && normFrag.length === 0) {
      for (let i = 0; i < styleAst.length; i++) {
        if (matched.has(i)) continue;
        if (normalizeText(styleAst[i].text).length === 0) {
          bestIdx = i;
          break;
        }
      }
    }

    if (bestIdx >= 0) {
      styleAst[bestIdx].math_latex = frag.latex;
      matched.add(bestIdx);
      count++;
    }
  }

  return count;
}

const MATH_APPENDIX_HEADING = "\n\n---\n本文中的数学公式（原文中公式处可能显示为空白）：\n";

/**
 * 在 Markdown 行数组中找到 needle 所在的行索引（normalize 后包含匹配）。
 * usedLines 记录已被占用的行，避免同一行重复匹配。
 *
 * mammoth 不生成 Markdown 表格，Word 表格单元格变成 1-2 字符的超短独立行。
 * 模糊匹配的 `norm.includes(normLine)` 方向对超短行极度脆弱，
 * 需要最短长度门槛防止远处公式跨文档命中表格碎片行。
 */
const MIN_FUZZY_LINE_LEN = 4;

function findLineIndex(
  lines: string[],
  needle: string,
  usedLines: Set<number>,
): number {
  const norm = normalizeText(needle);
  if (!norm) return -1;

  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const normLine = normalizeText(lines[i]);
    if (normLine === norm) return i;
  }

  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const normLine = normalizeText(lines[i]);
    if (!normLine) continue;
    if (normLine.includes(norm)) return i;
    if (normLine.length >= MIN_FUZZY_LINE_LEN && norm.includes(normLine)) return i;
  }

  const normStripped = normalizeText(stripMarkdownInline(needle));
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const stripped = normalizeText(stripMarkdownInline(lines[i]));
    if (!stripped) continue;
    if (stripped === normStripped) return i;
    if (stripped.includes(normStripped)) return i;
    if (stripped.length >= MIN_FUZZY_LINE_LEN && normStripped.includes(stripped)) return i;
  }

  return -1;
}

/** Mammoth 常把段首插图与说明字变成 `![图N]()`，导致 paragraphText 无法整行匹配；取最长后缀对齐替换 */
const MIN_SUFFIX_REPLACE_LEN = 24;

function longestParagraphSuffixContainedInLine(paragraphText: string, line: string): string {
  for (let i = 0; i < paragraphText.length; i++) {
    const suf = paragraphText.slice(i);
    if (line.includes(suf)) return suf;
  }
  return "";
}

/**
 * 内联替换专用：必须能在该行找到足够长的 paragraphText 后缀，避免
 * `norm.includes(短行)` 把长段落误匹配到表格碎片等先行行。
 */
function findLineIndexForInlineReplace(
  lines: string[],
  paragraphText: string,
  usedLines: Set<number>,
): number {
  let bestIdx = -1;
  let bestSuffixLen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const suf = longestParagraphSuffixContainedInLine(paragraphText, lines[i]);
    if (suf.length >= MIN_SUFFIX_REPLACE_LEN && suf.length > bestSuffixLen) {
      bestSuffixLen = suf.length;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function replaceParagraphTextInLine(
  line: string,
  paragraphText: string,
  textWithMath: string,
): string | null {
  if (!paragraphText) return null;
  if (line.includes(paragraphText)) {
    return line.replace(paragraphText, textWithMath);
  }
  const suf = longestParagraphSuffixContainedInLine(paragraphText, line);
  if (suf.length < MIN_SUFFIX_REPLACE_LEN) return null;
  const idx = line.indexOf(suf);
  if (idx < 0) return null;
  const prefixLen = paragraphText.length - suf.length;
  if (prefixLen > textWithMath.length) return null;
  const replacement = textWithMath.slice(prefixLen);
  return line.slice(0, idx) + replacement + line.slice(idx + suf.length);
}

/**
 * 将公式内联插入 Markdown（取代末尾附录模式）。
 *
 * - 内联且存在 textWithMath：在匹配行内用 textWithMath 替换 paragraphText（保留行首尾的 Markdown 标记）
 * - 内联无 textWithMath：在匹配行末尾追加 $...$
 * - display 公式：用 prevText 定位前文行，在其后插入独立行 $$...$$
 * - 未匹配公式：回退到末尾附录保底
 */
export function appendMathToMarkdown(
  markdown: string,
  fragments: MathFragment[],
): string {
  if (fragments.length === 0) return markdown;

  const lines = markdown.split("\n");
  const usedLines = new Set<number>();
  const unmatched: MathFragment[] = [];

  for (const frag of fragments) {
    const texJoined = frag.latex.map((t) =>
      frag.display ? `$$${t}$$` : `$${t}$`,
    ).join(" ");

    if (!frag.display && frag.paragraphText.trim()) {
      let idx = frag.textWithMath
        ? findLineIndexForInlineReplace(lines, frag.paragraphText, usedLines)
        : findLineIndex(lines, frag.paragraphText, usedLines);
      if (idx < 0 && frag.textWithMath) {
        idx = findLineIndex(lines, frag.paragraphText, usedLines);
      }
      if (idx >= 0) {
        if (frag.textWithMath) {
          const replaced = replaceParagraphTextInLine(
            lines[idx],
            frag.paragraphText,
            frag.textWithMath,
          );
          if (replaced !== null) {
            lines[idx] = replaced;
            usedLines.add(idx);
            continue;
          }
          unmatched.push(frag);
          continue;
        }
        lines[idx] = lines[idx] + " " + texJoined;
        usedLines.add(idx);
        continue;
      }
    }

    if (frag.display && frag.prevText) {
      const idx = findLineIndex(lines, frag.prevText, usedLines);
      if (idx >= 0) {
        const displayBlock = "\n\n" + frag.latex.map((t) => `$$${t}$$`).join("\n");
        lines[idx] = lines[idx] + displayBlock;
        usedLines.add(idx);
        continue;
      }
    }

    unmatched.push(frag);
  }

  let result = lines.join("\n");

  if (unmatched.length > 0) {
    const fallback: string[] = [];
    for (const frag of unmatched) {
      const ctx = frag.paragraphText.trim();
      const ctxSnippet = ctx.length > 30 ? ctx.slice(0, 30) + "…" : ctx;
      const prefix = ctxSnippet
        ? `段落"${ctxSnippet}"中的公式`
        : "独立公式";
      for (const tex of frag.latex) {
        const wrap = frag.display ? `$$${tex}$$` : `$${tex}$`;
        fallback.push(`- ${prefix}：${wrap}`);
      }
    }
    result += MATH_APPENDIX_HEADING + fallback.join("\n") + "\n";
  }

  return result;
}
