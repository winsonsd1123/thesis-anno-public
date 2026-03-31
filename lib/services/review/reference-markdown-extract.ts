/**
 * 从 Hybrid/Mammoth 产出的 Markdown 中纯代码提取参考文献列表（末次标题 + 分条）。
 * 供 reference.service 在 LLM 兜底前优先调用。
 */

/** 与 `reference.service` 中 `referenceItemSchema` 结构一致，避免循环依赖。 */
export type MarkdownExtractedReference = {
  id: number;
  title: string;
  rawText: string;
  authors?: string[];
};

/**
 * 整行仅为参考文献章节标题（去掉 #、可选尾注冒号后），避免正文句内「参考文献」子串误匹配。
 */
const BIBLIOGRAPHY_HEADING_EXACT =
  /^(?:参\s*考\s*文\s*献|参考文献|References|REFERENCE|Bibliography|BIBLIOGRAPHY|Works\s+Cited|WORKS\s+CITED)\s*$/i;

/**
 * 判断一行（去掉行首 # 与空白后）是否为参考文献章节标题。
 */
function skipOneLineBreak(s: string, pos: number): number {
  if (s[pos] === "\r" && s[pos + 1] === "\n") return pos + 2;
  if (s[pos] === "\n" || s[pos] === "\r") return pos + 1;
  return pos;
}

/** 第 `lineIndex` 行（0-based）第一个字符在 `raw` 中的下标。 */
function lineStartOffset(raw: string, lineIndex: number): number {
  const lines = raw.split(/\r?\n/);
  let o = 0;
  for (let i = 0; i < lineIndex; i++) {
    o += lines[i]!.length;
    o = skipOneLineBreak(raw, o);
  }
  return o;
}

export function isBibliographyHeadingLine(line: string): boolean {
  const t = line.replace(/\u00a0/g, " ").trim();
  if (!t) return false;
  const withoutHash = t.replace(/^#{1,6}\s+/, "").trim();
  if (!withoutHash) return false;
  // 去掉 HTML 标签（如 hybrid-docx-parser 产出的 <a id="..."></a> 书签锚点）
  const withoutHtml = withoutHash.replace(/<[^>]+>/g, "").trim();
  const core = withoutHtml.replace(/[:：]\s*$/, "").trim();
  return BIBLIOGRAPHY_HEADING_EXACT.test(core);
}

/**
 * 末次参考文献标题行第一个字符的下标；未找到返回 null。
 */
export function findLastBibliographyHeadingLineStart(markdown: string): number | null {
  const lines = markdown.split(/\r?\n/);
  let lastLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isBibliographyHeadingLine(lines[i]!)) {
      lastLineIdx = i;
    }
  }
  if (lastLineIdx < 0) return null;
  return lineStartOffset(markdown, lastLineIdx);
}

/**
 * 返回末次参考文献标题行之后正文的起始下标（从该行换行后开始）；未找到返回 null。
 */
export function findLastBibliographyBodyStart(markdown: string): number | null {
  const lines = markdown.split(/\r?\n/);
  let lastLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isBibliographyHeadingLine(lines[i]!)) {
      lastLineIdx = i;
    }
  }
  if (lastLineIdx < 0) return null;

  const lineStart = lineStartOffset(markdown, lastLineIdx);
  const headingLen = lines[lastLineIdx]!.length;
  let start = lineStart + headingLen;
  return skipOneLineBreak(markdown, start);
}

/** 新条目行首：编号或列表标记 */
const ENTRY_LINE_START =
  /^\s*(?:\[\d+\]|［\d+］|\d+\.\s*|（\d+）|\(\d+\)|[-*•]\s+\[\d+\]|[-*•]\s+\d+\.\s*)/;

/** 同一行内下一条（用于超长行） */
const SAME_LINE_NEXT_ENTRY = /(?=\[\d+\])/g;

function splitEntryChunks(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const s = buf.trim();
    if (s) chunks.push(s);
    buf = "";
  };

  for (const line of lines) {
    const ln = line.replace(/\u00a0/g, " ");
    if (ENTRY_LINE_START.test(ln) && buf.trim()) {
      flush();
      buf = ln;
    } else if (ENTRY_LINE_START.test(ln) && !buf.trim()) {
      buf = ln;
    } else {
      buf = buf ? `${buf}\n${ln}` : ln;
    }
  }
  flush();

  if (chunks.length <= 1 && trimmed.includes("[") && /\[\d+\]/.test(trimmed)) {
    const parts = trimmed.split(SAME_LINE_NEXT_ENTRY).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return chunks;
}

const BOOK_TITLE_CN = /《([^》\n]{2,200})》/;
const QUOTED_TITLE = /["“]([^"”\n]{2,200})["”]/;
const GBT_TYPE = /\[[A-ZＡ-Ｚa-z]\]\s*[.。]\s*/;

function inferTitleFromRaw(raw: string): string {
  let s = raw.replace(/\u00a0/g, " ").trim();
  s = s.replace(
    /^\s*(?:\[\d+\]|[［]\d+[］]|［\d+］|\d+\.\s+|（\d+）|\(\d+\)|[-*•]\s+)/,
    ""
  );
  s = s.trim();

  const m1 = s.match(BOOK_TITLE_CN);
  if (m1?.[1]) return m1[1].trim();

  const m2 = s.match(QUOTED_TITLE);
  if (m2?.[1]) return m2[1].trim();

  const gbt = s.match(GBT_TYPE);
  if (gbt && gbt.index !== undefined) {
    const after = s.slice(gbt.index + gbt[0].length).trim();
    const take = after.split(/[.。]\s*/)[0]?.trim();
    if (take && take.length >= 2 && take.length <= 300) return take;
  }

  const firstSeg = s.split(/[.。]\s*/)[0]?.trim() ?? s;
  if (firstSeg.length <= 300) return firstSeg || s.slice(0, 200);
  return s.slice(0, 200).trim();
}

function toReferenceItems(chunks: string[]): MarkdownExtractedReference[] {
  const out: MarkdownExtractedReference[] = [];
  let id = 1;
  for (const rawText of chunks) {
    const title = inferTitleFromRaw(rawText);
    out.push({
      id: id++,
      title: title || rawText.slice(0, 120).trim(),
      rawText: rawText.replace(/\u00a0/g, " ").trim(),
    });
  }
  return out;
}

/**
 * 纯代码从 Markdown 提取参考文献；无标题或分条为空时返回 []（调用方应走 LLM 兜底）。
 */
export function extractReferencesFromMarkdown(markdown: string): MarkdownExtractedReference[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const start = findLastBibliographyBodyStart(trimmed);
  if (start === null) return [];

  const body = trimmed.slice(start);
  const chunks = splitEntryChunks(body);
  if (chunks.length === 0) return [];

  return toReferenceItems(chunks);
}
