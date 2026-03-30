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

    if (mathNodes.length === 0) continue;

    const textParts: string[] = [];
    collectNonMathText(p, textParts);
    const paragraphText = textParts.join("");

    const latexFragments: string[] = [];
    for (const mathNode of mathNodes) {
      try {
        const mathmlEl = omml2mathml(mathNode);
        const latex = MathMLToLaTeX.convert(mathmlEl.outerHTML);
        if (latex.trim()) latexFragments.push(latex.trim());
      } catch {
        // unconvertible formula — skip
      }
    }

    if (latexFragments.length > 0) {
      results.push({ paragraphText, latex: latexFragments, display: isDisplay });
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

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
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
 * 在 Markdown 末尾追加公式附录，供 LLM 审阅时参考。
 */
export function appendMathToMarkdown(
  markdown: string,
  fragments: MathFragment[],
): string {
  if (fragments.length === 0) return markdown;

  const lines: string[] = [];
  for (const frag of fragments) {
    const ctx = frag.paragraphText.trim();
    const ctxSnippet = ctx.length > 30 ? ctx.slice(0, 30) + "…" : ctx;
    const prefix = ctxSnippet
      ? `段落"${ctxSnippet}"中的公式`
      : "独立公式";

    for (const tex of frag.latex) {
      const wrap = frag.display ? `$$${tex}$$` : `$${tex}$`;
      lines.push(`- ${prefix}：${wrap}`);
    }
  }

  return markdown + MATH_APPENDIX_HEADING + lines.join("\n") + "\n";
}
