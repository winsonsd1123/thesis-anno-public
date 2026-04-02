import { XMLParser } from "fast-xml-parser";
import type { DocxStyleAstNode, DocumentSetup, ParagraphContext, RunSpan, DocumentPartition } from "@/lib/types/docx-hybrid";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
  trimValues: false,
});

export type ThemeFontMap = {
  majorEastAsia?: string;
  minorEastAsia?: string;
  majorAscii?: string;
  minorAscii?: string;
};

const EMPTY_THEME: ThemeFontMap = {};

/**
 * 从 theme1.xml 提取主题字体映射。
 * 路径：theme > themeElements > fontScheme > majorFont/minorFont 下的
 *       ea/@typeface（东亚）和 latin/@typeface（西文）。
 *
 * 当 `<a:ea typeface="">` 为空时（中文版 Office 常见），
 * 回退到 `<a:font script="Hans">` 取简体中文字体。
 */
export function parseThemeFonts(themeXml: string | null): ThemeFontMap {
  if (!themeXml) return EMPTY_THEME;
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(themeXml) as Record<string, unknown>;
  } catch {
    return EMPTY_THEME;
  }
  const theme = (doc.theme ?? doc) as Record<string, unknown>;
  const elems = theme.themeElements as Record<string, unknown> | undefined;
  if (!elems) return EMPTY_THEME;
  const fs = elems.fontScheme as Record<string, unknown> | undefined;
  if (!fs) return EMPTY_THEME;

  const pickTypeface = (group: unknown, tag: string): string | undefined => {
    if (!group || typeof group !== "object") return undefined;
    const g = group as Record<string, unknown>;
    const el = g[tag];
    if (!el || typeof el !== "object") return undefined;
    const o = el as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("@_") && typeof v === "string" && k.toLowerCase().includes("typeface")) {
        return v || undefined;
      }
    }
    return undefined;
  };

  /** 从 majorFont/minorFont 的 `<a:font script="Hans">` 取简体中文字体 */
  const pickScriptHansTypeface = (group: unknown): string | undefined => {
    if (!group || typeof group !== "object") return undefined;
    const g = group as Record<string, unknown>;
    for (const fontEl of ensureArray(g.font)) {
      if (!fontEl || typeof fontEl !== "object") continue;
      const fo = fontEl as Record<string, unknown>;
      let isHans = false;
      let typeface: string | undefined;
      for (const [k, v] of Object.entries(fo)) {
        if (!k.startsWith("@_") || typeof v !== "string") continue;
        const bare = k.slice(2).toLowerCase();
        if (bare === "script" && v === "Hans") isHans = true;
        if (bare === "typeface" && v) typeface = v;
      }
      if (isHans && typeface) return typeface;
    }
    return undefined;
  };

  return {
    majorEastAsia: pickTypeface(fs.majorFont, "ea") ?? pickScriptHansTypeface(fs.majorFont),
    minorEastAsia: pickTypeface(fs.minorFont, "ea") ?? pickScriptHansTypeface(fs.minorFont),
    majorAscii: pickTypeface(fs.majorFont, "latin"),
    minorAscii: pickTypeface(fs.minorFont, "latin"),
  };
}

type RPrParts = {
  fontEastAsia?: string;
  fontAscii?: string;
  fontEastAsiaTheme?: string;
  fontAsciiTheme?: string;
  sizeHalfPoints?: number;
  bold?: boolean;
  italic?: boolean;
};

/** 段落 w:spacing + w:ind 的规范中间形式（磅 / 倍数 / 字符） */
type ParagraphSpacingInd = {
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  spaceBeforeLines?: number;
  spaceAfterLines?: number;
  lineSpacingPt?: number;
  lineSpacingMultiple?: number;
  indentFirstLinePt?: number;
  indentFirstLineChars?: number;
};

type StyleDef = {
  rPr: RPrParts;
  basedOn?: string;
  outlineLvl?: number;
  /** 来自 styles.xml 中该样式 w:pPr 的 w:jc/@w:val（小写） */
  jcVal?: string;
  /** 来自 styles.xml 中该样式 w:pPr 的 spacing/ind（无则空） */
  spacingInd?: ParagraphSpacingInd;
};

function ensureArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function pickAttrVal(obj: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("@_")) continue;
    const bare = k.slice(2);
    if (/(^|[:])val$/i.test(bare)) {
      if (typeof v === "string") return v;
    }
  }
  return undefined;
}

function pickFontAttr(obj: Record<string, unknown>, ...names: string[]): string | undefined {
  const lowerNames = names.map((n) => n.toLowerCase());
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("@_") || typeof v !== "string") continue;
    const bare = k.slice(2).toLowerCase().replace(/^[^:]+:/, "");
    if (lowerNames.includes(bare)) return v;
  }
  return undefined;
}

function hasBoolOn(b: unknown): boolean | undefined {
  if (b === undefined) return undefined;
  if (typeof b === "boolean") return b;
  if (Array.isArray(b)) {
    const results = b.map((x) => hasBoolOn(x)).filter((x) => x !== undefined);
    if (results.some((x) => x === true)) return true;
    if (results.some((x) => x === false)) return false;
    return undefined;
  }
  if (typeof b === "object" && b !== null) {
    const val = pickAttrVal(b as Record<string, unknown>);
    if (val === "0" || val === "false") return false;
    if (val === "1" || val === "true") return true;
    return true;
  }
  return undefined;
}

function extractRPr(raw: unknown): RPrParts {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  let sizeHalfPoints: number | undefined;
  for (const s of ensureArray(o.sz)) {
    if (s && typeof s === "object") {
      const v = pickAttrVal(s as Record<string, unknown>);
      if (v) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) sizeHalfPoints = n;
      }
    }
  }
  let fontEastAsia: string | undefined;
  let fontAscii: string | undefined;
  let fontEastAsiaTheme: string | undefined;
  let fontAsciiTheme: string | undefined;
  const rf = o.rFonts;
  if (rf && typeof rf === "object") {
    const rfo = rf as Record<string, unknown>;
    fontEastAsia = pickFontAttr(rfo, "eastAsia", "eastasia");
    fontAscii = pickFontAttr(rfo, "ascii", "hAnsi", "hansi");
    fontEastAsiaTheme = pickFontAttr(rfo, "eastAsiaTheme", "eastasiatheme");
    fontAsciiTheme = pickFontAttr(rfo, "asciiTheme", "asciitheme", "hAnsiTheme", "hansitheme");
  }
  return {
    fontEastAsia,
    fontAscii,
    fontEastAsiaTheme,
    fontAsciiTheme,
    sizeHalfPoints,
    bold: hasBoolOn(o.b),
    italic: hasBoolOn(o.i),
  };
}

function mergeRPr(parent: RPrParts, child: RPrParts): RPrParts {
  const out: RPrParts = { ...parent };
  (Object.keys(child) as (keyof RPrParts)[]).forEach((k) => {
    const v = child[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  });
  return out;
}

function getStyleIdFromElement(so: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(so)) {
    if (!k.startsWith("@_") || typeof v !== "string") continue;
    const bare = k.slice(2).toLowerCase();
    if (bare.endsWith("styleid")) return v;
  }
  return undefined;
}

function extractBasedOn(so: Record<string, unknown>): string | undefined {
  const bo = so.basedOn;
  if (!bo || typeof bo !== "object") return undefined;
  return pickAttrVal(bo as Record<string, unknown>);
}

/** styles.xml 中 w:name/@w:val，如 "toc 1"、"heading 1" */
function getStyleNameVal(so: Record<string, unknown>): string | undefined {
  const nm = so.name;
  if (!nm || typeof nm !== "object") return undefined;
  return pickAttrVal(nm as Record<string, unknown>);
}

function getOutlineLevel(pPr: unknown): number | undefined {
  if (!pPr || typeof pPr !== "object") return undefined;
  const oLvl = (pPr as Record<string, unknown>).outlineLvl;
  if (!oLvl || typeof oLvl !== "object") return undefined;
  for (const [k, v] of Object.entries(oLvl)) {
    if (k.toLowerCase().endsWith("val")) {
      const n = parseInt(String(v), 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function pickPPrAttrInt(obj: Record<string, unknown>, bareName: string): number | undefined {
  const want = bareName.toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("@_")) continue;
    const bare = k.slice(2).toLowerCase().replace(/^[^:]+:/, "");
    if (bare !== want) continue;
    const n = parseInt(String(v), 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function pickPPrAttrString(obj: Record<string, unknown>, bareName: string): string | undefined {
  const want = bareName.toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("@_")) continue;
    const bare = k.slice(2).toLowerCase().replace(/^[^:]+:/, "");
    if (bare !== want) continue;
    if (typeof v === "string") return v;
  }
  return undefined;
}

/** 解析单个 w:spacing 元素（属性在元素上） */
function parseSpacingElement(sp: unknown): ParagraphSpacingInd {
  if (!sp || typeof sp !== "object") return {};
  const o = sp as Record<string, unknown>;
  const out: ParagraphSpacingInd = {};
  const before = pickPPrAttrInt(o, "before");
  const after = pickPPrAttrInt(o, "after");
  const beforeLines = pickPPrAttrInt(o, "beforeLines");
  const afterLines = pickPPrAttrInt(o, "afterLines");
  const line = pickPPrAttrInt(o, "line");
  const lineRule = (pickPPrAttrString(o, "lineRule") ?? "").toLowerCase();

  if (before !== undefined) out.spaceBeforePt = before / 20;
  if (after !== undefined) out.spaceAfterPt = after / 20;
  if (beforeLines !== undefined) out.spaceBeforeLines = beforeLines / 100;
  if (afterLines !== undefined) out.spaceAfterLines = afterLines / 100;
  if (line !== undefined) {
    if (lineRule === "auto") {
      out.lineSpacingMultiple = line / 240;
    } else {
      out.lineSpacingPt = line / 20;
    }
  }
  return out;
}

/** 解析单个 w:ind 元素 */
function parseIndElement(ind: unknown): ParagraphSpacingInd {
  if (!ind || typeof ind !== "object") return {};
  const o = ind as Record<string, unknown>;
  const out: ParagraphSpacingInd = {};
  const firstLine = pickPPrAttrInt(o, "firstLine");
  const firstLineChars = pickPPrAttrInt(o, "firstLineChars");
  if (firstLine !== undefined && firstLine !== 0) {
    out.indentFirstLinePt = firstLine / 20;
  }
  if (firstLineChars !== undefined && firstLineChars !== 0) {
    out.indentFirstLineChars = firstLineChars / 100;
  }
  return out;
}

/** 读取 w:pPr/w:jc/@w:val，统一为小写（center、left、both 等） */
function extractJcValFromPPr(pPr: unknown): string | undefined {
  if (!pPr || typeof pPr !== "object") return undefined;
  const jc = (pPr as Record<string, unknown>).jc;
  for (const el of ensureArray(jc)) {
    if (!el || typeof el !== "object") continue;
    const v = pickAttrVal(el as Record<string, unknown>);
    if (v && typeof v === "string") return v.trim().toLowerCase();
  }
  return undefined;
}

function extractSpacingIndFromPPr(pPr: unknown): ParagraphSpacingInd {
  if (!pPr || typeof pPr !== "object") return {};
  const pp = pPr as Record<string, unknown>;
  const sp0 = ensureArray(pp.spacing)[0];
  const ind0 = ensureArray(pp.ind)[0];
  return {
    ...parseSpacingElement(sp0),
    ...parseIndElement(ind0),
  };
}

function mergeSpacingInd(parent: ParagraphSpacingInd, child: ParagraphSpacingInd): ParagraphSpacingInd {
  const out: ParagraphSpacingInd = { ...parent };
  (Object.keys(child) as (keyof ParagraphSpacingInd)[]).forEach((k) => {
    const v = child[k];
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function spacingIndToAstFields(si: ParagraphSpacingInd): Partial<DocxStyleAstNode> {
  const o: Partial<DocxStyleAstNode> = {};
  if (si.lineSpacingPt !== undefined) o.line_spacing_pt = si.lineSpacingPt;
  if (si.lineSpacingMultiple !== undefined) o.line_spacing_multiple = si.lineSpacingMultiple;
  if (si.spaceBeforePt !== undefined) o.space_before_pt = si.spaceBeforePt;
  if (si.spaceAfterPt !== undefined) o.space_after_pt = si.spaceAfterPt;
  if (si.spaceBeforeLines !== undefined) o.space_before_lines = si.spaceBeforeLines;
  if (si.spaceAfterLines !== undefined) o.space_after_lines = si.spaceAfterLines;
  if (si.indentFirstLineChars !== undefined) o.indent_first_line_chars = si.indentFirstLineChars;
  if (si.indentFirstLinePt !== undefined) o.indent_first_line_pt = si.indentFirstLinePt;
  return o;
}

type ParsedStyles = {
  map: Map<string, StyleDef>;
  /** w:docDefaults/w:rPrDefault/w:rPr — 文档级默认字号/字体 */
  docDefaultsRPr: RPrParts;
  /** w:default="1" 的段落样式 ID（通常为 Normal），无 pStyle 时隐式使用 */
  defaultParagraphStyleId?: string;
  /** 样式名为 TOC* 的 w:styleId 集合，用于延长 toc 分区、避免目录项被当正文 */
  tocStyleIds: Set<string>;
};

function parseStyles(stylesXml: string | null): ParsedStyles {
  const map = new Map<string, StyleDef>();
  const tocStyleIds = new Set<string>();
  const empty: ParsedStyles = { map, docDefaultsRPr: {}, tocStyleIds };
  if (!stylesXml) return empty;
  const doc = parser.parse(stylesXml) as Record<string, unknown>;
  const stylesRoot = doc.styles as Record<string, unknown> | undefined;
  if (!stylesRoot) return empty;

  let docDefaultsRPr: RPrParts = {};
  const dd = stylesRoot.docDefaults;
  if (dd && typeof dd === "object") {
    const rPrDefault = (dd as Record<string, unknown>).rPrDefault;
    if (rPrDefault && typeof rPrDefault === "object") {
      docDefaultsRPr = extractRPr((rPrDefault as Record<string, unknown>).rPr);
    }
  }

  let defaultParagraphStyleId: string | undefined;

  for (const st of ensureArray(stylesRoot.style)) {
    if (!st || typeof st !== "object") continue;
    const so = st as Record<string, unknown>;
    const id = getStyleIdFromElement(so);
    if (!id) continue;
    const styleName = getStyleNameVal(so);
    if (styleName && /^toc\b/i.test(styleName.trim())) {
      tocStyleIds.add(id);
    }

    // w:default="1" 且 w:type="paragraph" → 默认段落样式
    if (!defaultParagraphStyleId) {
      for (const [k, v] of Object.entries(so)) {
        if (!k.startsWith("@_")) continue;
        const bare = k.slice(2).toLowerCase();
        if (bare.endsWith("default") && (v === "1" || v === "true" || v === true)) {
          const typeAttr = Object.entries(so).find(([tk, tv]) =>
            tk.startsWith("@_") && tk.slice(2).toLowerCase().endsWith("type") && tv === "paragraph"
          );
          if (typeAttr) defaultParagraphStyleId = id;
        }
      }
    }

    map.set(id, {
      rPr: extractRPr(so.rPr),
      basedOn: extractBasedOn(so),
      outlineLvl: getOutlineLevel(so.pPr),
      jcVal: extractJcValFromPPr(so.pPr),
      spacingInd: extractSpacingIndFromPPr(so.pPr),
    });
  }
  return { map, docDefaultsRPr, defaultParagraphStyleId, tocStyleIds };
}

function getStyleRPrResolved(
  styleId: string,
  map: Map<string, StyleDef>,
  docDefaultsRPr: RPrParts,
  depth = 0,
): RPrParts {
  if (depth > 24) return {};
  const def = map.get(styleId);
  if (!def) return {};
  const parent = def.basedOn
    ? getStyleRPrResolved(def.basedOn, map, docDefaultsRPr, depth + 1)
    : docDefaultsRPr;
  return mergeRPr(parent, def.rPr);
}

function getStyleOutlineLvlResolved(
  styleId: string,
  map: Map<string, StyleDef>,
  depth = 0,
): number | undefined {
  if (depth > 24) return undefined;
  const def = map.get(styleId);
  if (!def) return undefined;
  if (def.outlineLvl !== undefined) return def.outlineLvl;
  if (def.basedOn) {
    return getStyleOutlineLvlResolved(def.basedOn, map, depth + 1);
  }
  return undefined;
}

function getStyleSpacingIndResolved(
  styleId: string,
  map: Map<string, StyleDef>,
  depth = 0,
): ParagraphSpacingInd {
  if (depth > 24) return {};
  const def = map.get(styleId);
  if (!def) return {};
  const parent = def.basedOn ? getStyleSpacingIndResolved(def.basedOn, map, depth + 1) : {};
  return mergeSpacingInd(parent, def.spacingInd ?? {});
}

function getStyleJcResolved(styleId: string, map: Map<string, StyleDef>, depth = 0): string | undefined {
  if (depth > 24) return undefined;
  const def = map.get(styleId);
  if (!def) return undefined;
  const parent = def.basedOn ? getStyleJcResolved(def.basedOn, map, depth + 1) : undefined;
  return def.jcVal ?? parent;
}

function getPStyleId(p: unknown): string | undefined {
  if (!p || typeof p !== "object") return undefined;
  const pPr = (p as Record<string, unknown>).pPr;
  if (!pPr || typeof pPr !== "object") return undefined;
  const ps = (pPr as Record<string, unknown>).pStyle;
  if (!ps || typeof ps !== "object") return undefined;
  return pickAttrVal(ps as Record<string, unknown>);
}

function getRStyleId(run: unknown): string | undefined {
  if (!run || typeof run !== "object") return undefined;
  const rPr = (run as Record<string, unknown>).rPr;
  if (!rPr || typeof rPr !== "object") return undefined;
  const rs = (rPr as Record<string, unknown>).rStyle;
  if (!rs || typeof rs !== "object") return undefined;
  return pickAttrVal(rs as Record<string, unknown>);
}

function extractWText(t: unknown): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") {
    const o = t as Record<string, unknown>;
    if (typeof o["#text"] === "string") return o["#text"];
  }
  return "";
}

function collectTextFromRun(run: unknown): string {
  if (!run || typeof run !== "object") return "";
  const o = run as Record<string, unknown>;
  const parts: string[] = [];
  if ("t" in o) {
    for (const t of ensureArray(o.t)) {
      parts.push(extractWText(t));
    }
  }
  if ("tab" in o) parts.push("\t");
  if ("br" in o) parts.push("\n");
  return parts.join("");
}

function effectiveRunRPr(
  paragraphStyleId: string | undefined,
  run: unknown,
  styleMap: Map<string, StyleDef>,
  docDefaultsRPr: RPrParts,
): RPrParts {
  const paraRpr = paragraphStyleId
    ? getStyleRPrResolved(paragraphStyleId, styleMap, docDefaultsRPr)
    : docDefaultsRPr;
  const rStyleId = getRStyleId(run);
  const charRpr = rStyleId ? getStyleRPrResolved(rStyleId, styleMap, {}) : {};
  const direct =
    run && typeof run === "object" ? extractRPr((run as Record<string, unknown>).rPr) : {};
  return mergeRPr(mergeRPr(paraRpr, charRpr), direct);
}

type TaggedParagraph = { raw: unknown; context: ParagraphContext };

function collectParagraphElements(
  node: unknown,
  acc: TaggedParagraph[],
  insideTable: boolean,
): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectParagraphElements(n, acc, insideTable));
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;

  if ("tbl" in o) {
    for (const tbl of ensureArray(o.tbl)) {
      collectParagraphElements(tbl, acc, true);
    }
  }

  if ("p" in o) {
    for (const p of ensureArray(o.p)) {
      acc.push({ raw: p, context: insideTable ? "table_cell" : "body" });
    }
  }

  for (const [k, v] of Object.entries(o)) {
    if (k === "p" || k === "tbl" || k.startsWith("@_")) continue;
    collectParagraphElements(v, acc, insideTable);
  }
}

const CAPTION_STYLE_SUBSTRINGS = ["caption", "题注", "图题", "表题"];
const CAPTION_TEXT_RE = /^(图|表|Figure|Table|Fig\.?)\s*\d/i;
/** 常见表下「注：」、数据来源等（不要求居中） */
const CAPTION_PREFIX_RE =
  /^(注|说明|資料來源|数据来源|资料来源|附\s*表|附\s*图|单位)[:：]/;
/** 居中短段兜底：须同时命中其一，且长度上限避免把误居中的长正文当题注 */
const CAPTION_WEAK_HINT_RE =
  /^图\s|^表\s|^Figure|^Table|示意图|架构图|流程图|统计表|对比表|数据来源|资料来源|資料來源|模型结构|实验结果|如图所示|如下图|见下图|见上图/i;

const CAPTION_CENTER_MAX_CHARS = 72;

function inferCaptionContext(
  pStyleId: string | undefined,
  text: string,
  outlineLevel: number | undefined,
  jcVal: string | undefined,
): boolean {
  if (pStyleId) {
    const low = pStyleId.toLowerCase();
    for (const s of CAPTION_STYLE_SUBSTRINGS) {
      if (low.includes(s.toLowerCase())) return true;
    }
  }
  const t = text.trim();
  // 真正的题注通常较短（图/表名），正文引图句即使以「图5-2」开头也远超此阈值
  const CAPTION_TEXT_MAX_CHARS = 40;
  if (CAPTION_TEXT_RE.test(t) && t.length <= CAPTION_TEXT_MAX_CHARS) return true;
  if (CAPTION_PREFIX_RE.test(t)) return true;

  if (jcVal === "center" && t.length > 0 && t.length <= CAPTION_CENTER_MAX_CHARS) {
    if (outlineLevel !== undefined && outlineLevel >= 0 && outlineLevel <= 8) {
      return false;
    }
    if (CAPTION_WEAK_HINT_RE.test(t)) return true;
  }
  return false;
}

const FOOTNOTE_STYLE_SUBSTRINGS = ["footnote", "脚注文字", "脚注"];

function inferFootnotesContext(pStyleId: string | undefined): boolean {
  if (!pStyleId) return false;
  const low = pStyleId.toLowerCase();
  return FOOTNOTE_STYLE_SUBSTRINGS.some((s) => low.includes(s.toLowerCase()));
}

const REFERENCES_HEADING_RE = /^(参\s*考\s*文\s*献|references|bibliography|works?\s*cited)$/i;

/** 1 cm = 1440/2.54 ≈ 566.93 twips；取 567 为整数近似 */
function twipsToCm(twips: number): number {
  return twips / 567;
}

function extractDocumentSetup(finalSectPr: unknown): DocumentSetup {
  if (!finalSectPr || typeof finalSectPr !== "object") return {};
  const sectPr = finalSectPr as Record<string, unknown>;
  const pgMar = sectPr.pgMar;
  if (!pgMar || typeof pgMar !== "object") return {};
  const m = pgMar as Record<string, unknown>;
  const readTwips = (key: string): number | undefined => {
    const v = m[`@_${key}`];
    if (v === undefined || v === null) return undefined;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isNaN(n) ? undefined : n;
  };
  const top = readTwips("top");
  const bottom = readTwips("bottom");
  const left = readTwips("left");
  const right = readTwips("right");
  const margins: DocumentSetup["margins"] = {};
  if (top !== undefined) margins.top_cm = twipsToCm(top);
  if (bottom !== undefined) margins.bottom_cm = twipsToCm(bottom);
  if (left !== undefined) margins.left_cm = twipsToCm(left);
  if (right !== undefined) margins.right_cm = twipsToCm(right);
  if (Object.keys(margins).length === 0) return {};
  return { margins };
}

function parseDocumentParagraphs(documentXml: string): { tagged: TaggedParagraph[], finalSectPr: unknown } {
  const doc = parser.parse(documentXml) as Record<string, unknown>;
  const root = doc.document ?? doc;
  if (!root || typeof root !== "object") return { tagged: [], finalSectPr: undefined };
  const body = (root as Record<string, unknown>).body;
  if (!body) return { tagged: [], finalSectPr: undefined };
  const paragraphs: TaggedParagraph[] = [];
  collectParagraphElements(body, paragraphs, false);
  return { tagged: paragraphs, finalSectPr: (body as Record<string, unknown>).sectPr };
}

/** 检测段落 JSON 树中是否含有 PAGE 域（fldSimple 或 instrText） */
function hasPAGEField(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const po = p as Record<string, unknown>;

  // fldSimple[@_instr] 含 "PAGE"
  for (const fld of ensureArray(po.fldSimple)) {
    if (!fld || typeof fld !== "object") continue;
    const instr = (fld as Record<string, unknown>)["@_instr"];
    if (typeof instr === "string" && instr.includes("PAGE")) return true;
  }

  // run 内的 instrText 含 "PAGE"
  for (const run of ensureArray(po.r)) {
    if (!run || typeof run !== "object") continue;
    for (const instrText of ensureArray((run as Record<string, unknown>).instrText)) {
      const t = extractWText(instrText);
      if (t.includes("PAGE")) return true;
    }
  }
  return false;
}

/** 将页眉或页脚 XML 解析为 DocxStyleAstNode 数组，context 统一标记为 hfCtx */
function parseHeaderFooterXml(
  xml: string,
  hfCtx: "header" | "footer",
  styleMap: Map<string, StyleDef>,
  docDefaultsRPr: RPrParts,
  themeMap: ThemeFontMap = EMPTY_THEME,
  defaultParagraphStyleId?: string,
): DocxStyleAstNode[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  // 页眉根元素为 w:hdr，页脚为 w:ftr；removeNSPrefix 后去掉 w: 前缀
  const root = doc.hdr ?? doc.ftr ?? doc;
  if (!root || typeof root !== "object") return [];

  const tagged: TaggedParagraph[] = [];
  collectParagraphElements(root, tagged, false);

  const nodes: DocxStyleAstNode[] = [];
  for (const t of tagged) {
    const node = paragraphToNode({ raw: t.raw, context: hfCtx }, styleMap, docDefaultsRPr, themeMap, defaultParagraphStyleId);
    if (hasPAGEField(t.raw)) {
      node.has_page_number = true;
    }
    // 清理内部标记字段（_isPageReset/_isTocField/_isSectPr 已在 paragraphToNode 末尾 delete）
    nodes.push(node);
  }
  return nodes;
}

function resolveThemeFont(
  explicit: string | undefined,
  themeRef: string | undefined,
  themeMap: ThemeFontMap,
  kind: "eastAsia" | "ascii",
): string | undefined {
  if (explicit) return explicit;
  if (!themeRef) return undefined;
  const key = themeRef.toLowerCase();
  if (kind === "eastAsia") {
    if (key.includes("major")) return themeMap.majorEastAsia;
    if (key.includes("minor")) return themeMap.minorEastAsia;
  } else {
    if (key.includes("major")) return themeMap.majorAscii;
    if (key.includes("minor")) return themeMap.minorAscii;
  }
  return undefined;
}

function rprToRunSpan(text: string, rpr: RPrParts, themeMap: ThemeFontMap): RunSpan {
  return {
    text,
    font_zh: resolveThemeFont(rpr.fontEastAsia, rpr.fontEastAsiaTheme, themeMap, "eastAsia"),
    font_en: resolveThemeFont(rpr.fontAscii, rpr.fontAsciiTheme, themeMap, "ascii"),
    size_pt: rpr.sizeHalfPoints !== undefined ? rpr.sizeHalfPoints / 2 : undefined,
    bold: rpr.bold,
    italic: rpr.italic,
  };
}

type InternalAstNode = DocxStyleAstNode & {
  _isPageReset?: boolean;
  _isTocField?: boolean;
  _isSectPr?: boolean;
};

function paragraphToNode(
  tagged: TaggedParagraph,
  styleMap: Map<string, StyleDef>,
  docDefaultsRPr: RPrParts,
  themeMap: ThemeFontMap = EMPTY_THEME,
  defaultParagraphStyleId?: string,
): InternalAstNode {
  const p = tagged.raw;
  const pStyleId = getPStyleId(p) ?? defaultParagraphStyleId;
  const pPr = p && typeof p === "object" ? (p as Record<string, unknown>).pPr : undefined;
  
  let outlineLevel = getOutlineLevel(pPr);
  if (outlineLevel === undefined && pStyleId) {
    outlineLevel = getStyleOutlineLvlResolved(pStyleId, styleMap);
  }

  const jcDirect = pPr ? extractJcValFromPPr(pPr) : undefined;
  const jcFromStyle = pStyleId ? getStyleJcResolved(pStyleId, styleMap) : undefined;
  const paragraphJc = jcDirect ?? jcFromStyle;

  const rawRuns = ensureArray((p as Record<string, unknown>).r);

  const spans: RunSpan[] = [];
  let _isTocField = false;

  for (const run of rawRuns) {
    if (run && typeof run === "object") {
      const instrText = (run as Record<string, unknown>).instrText;
      if (instrText) {
        for (const t of ensureArray(instrText)) {
          if (extractWText(t).includes("TOC")) {
            _isTocField = true;
          }
        }
      }
    }

    const runText = collectTextFromRun(run);
    if (runText.length === 0) continue;
    const eff = effectiveRunRPr(pStyleId, run, styleMap, docDefaultsRPr);
    spans.push(rprToRunSpan(runText, eff, themeMap));
  }

  const text = spans.map((s) => s.text).join("");

  let dominant: RunSpan | undefined;
  if (spans.length > 0) {
    dominant = spans.reduce((a, b) => (b.text.length > a.text.length ? b : a));
  }

  const fallbackRPr = pStyleId
    ? getStyleRPrResolved(pStyleId, styleMap, docDefaultsRPr)
    : docDefaultsRPr;

  let ctx = tagged.context;
  if (ctx === "body" && inferFootnotesContext(pStyleId)) {
    ctx = "footnotes";
  } else if (ctx === "body" && inferCaptionContext(pStyleId, text, outlineLevel, paragraphJc)) {
    ctx = "caption";
  }

  let _isPageReset = false;
  let _isSectPr = false;

  const spacingFromStyle = pStyleId ? getStyleSpacingIndResolved(pStyleId, styleMap) : {};
  const spacingFromDirect = pPr ? extractSpacingIndFromPPr(pPr) : {};
  const mergedSpacing = mergeSpacingInd(spacingFromStyle, spacingFromDirect);
  const spacingAst = spacingIndToAstFields(mergedSpacing);

  if (pPr && typeof pPr === "object") {
    const sectPr = (pPr as Record<string, unknown>).sectPr;
    if (sectPr && typeof sectPr === "object") {
      _isSectPr = true;
      const pgNumType = (sectPr as Record<string, unknown>).pgNumType;
      if (pgNumType && typeof pgNumType === "object") {
        let fmt: string | undefined;
        let start: string | undefined;
        for (const [k, v] of Object.entries(pgNumType)) {
          if (k.toLowerCase().endsWith("fmt") && typeof v === "string") fmt = v;
          if (k.toLowerCase().endsWith("start") && (typeof v === "string" || typeof v === "number")) start = String(v);
        }
        if (fmt === "decimal" && start === "1") {
          _isPageReset = true;
        }
      }
    }
  }

  return {
    text,
    font_zh: dominant?.font_zh ?? resolveThemeFont(fallbackRPr.fontEastAsia, fallbackRPr.fontEastAsiaTheme, themeMap, "eastAsia"),
    font_en: dominant?.font_en ?? resolveThemeFont(fallbackRPr.fontAscii, fallbackRPr.fontAsciiTheme, themeMap, "ascii"),
    size_pt: dominant?.size_pt ?? (fallbackRPr.sizeHalfPoints !== undefined ? fallbackRPr.sizeHalfPoints / 2 : undefined),
    bold: dominant?.bold ?? fallbackRPr.bold,
    italic: dominant?.italic ?? fallbackRPr.italic,
    paragraphStyleId: pStyleId,
    characterStyleId: rawRuns[0] ? getRStyleId(rawRuns[0]) : undefined,
    runs: spans.length > 0 ? spans : undefined,
    context: ctx,
    outlineLevel,
    ...(paragraphJc ? { paragraph_jc: paragraphJc } : {}),
    ...spacingAst,
    _isPageReset,
    _isTocField,
    _isSectPr,
  };
}

function isTocParagraph(node: InternalAstNode, tocStyleIds: Set<string>): boolean {
  const id = node.paragraphStyleId;
  return !!id && tocStyleIds.has(id);
}

function partitionDocumentAst(nodes: InternalAstNode[], finalSectPr: unknown, tocStyleIds: Set<string>) {
  let current: DocumentPartition = "front_cover";
  
  let lastSectionStartIndex = 0;
  let mainBodyStartIndex = -1;
  
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]._isPageReset) {
      mainBodyStartIndex = lastSectionStartIndex;
    }
    if (nodes[i]._isSectPr) {
      lastSectionStartIndex = i + 1;
    }
  }
  
  if (finalSectPr && typeof finalSectPr === "object") {
    const pgNumType = (finalSectPr as Record<string, unknown>).pgNumType;
    if (pgNumType && typeof pgNumType === "object") {
      let fmt: string | undefined;
      let start: string | undefined;
      for (const [k, v] of Object.entries(pgNumType)) {
        if (k.toLowerCase().endsWith("fmt") && typeof v === "string") fmt = v;
        if (k.toLowerCase().endsWith("start") && (typeof v === "string" || typeof v === "number")) start = String(v);
      }
      if (fmt === "decimal" && start === "1") {
        mainBodyStartIndex = lastSectionStartIndex;
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const text = node.text.trim();

    if (current === "front_cover" || current === "abstract" || current === "toc") {
      if (mainBodyStartIndex > 0 && i >= mainBodyStartIndex) {
        current = "main_body";
      } else if (
        current === "toc" &&
        !isTocParagraph(node, tocStyleIds) &&
        node.outlineLevel === 0 &&
        text.length > 0
      ) {
        current = "main_body";
      } else if (
        current === "toc" &&
        !isTocParagraph(node, tocStyleIds) &&
        /^(第[一二三四五六七八九十0-9]+章|1\s+绪论|1\s+引言)/.test(text)
      ) {
        current = "main_body";
      }
    }

    if (current === "front_cover") {
      if ((node.outlineLevel === 0 || (node.size_pt && node.size_pt >= 15)) && /^(中文)?摘\s*要$|^abstract$/i.test(text)) {
        current = "abstract";
      } else if ((node.outlineLevel === 0 || (node.size_pt && node.size_pt >= 15)) && /^目\s*录$|^contents$/i.test(text)) {
        current = "toc";
      } else if (node._isTocField) {
        current = "toc";
      }
    } else if (current === "abstract") {
      if ((node.outlineLevel === 0 || (node.size_pt && node.size_pt >= 15)) && /^目\s*录$|^contents$/i.test(text)) {
        current = "toc";
      } else if (node._isTocField) {
        current = "toc";
      }
    }

    if (current === "references") {
      if (/^致\s*谢$|^致谢$|^谢辞$|^声\s*明$/i.test(text) && text.length < 24) {
        current = "end_matter";
      }
    }

    if (current === "main_body" && REFERENCES_HEADING_RE.test(text) && text.length < 30) {
      current = "references";
    }

    node.partition = current;
    delete node._isPageReset;
    delete node._isTocField;
    delete node._isSectPr;
  }
}

/**
 * 从 `document.xml` + `styles.xml`（+ 可选页眉页脚 XML）构建段落级样式 AST。
 * - `nodes`：正文 AST，经过 partitionDocumentAst 分区标注。
 * - `headerFooterNodes`：页眉页脚节点，**不**经过分区，独立返回。
 * - `setup`：文档全局设置（页边距）。
 */
export function buildDocxStyleAst(
  documentXml: string,
  stylesXml: string | null,
  headerXmls: string[] = [],
  footerXmls: string[] = [],
  themeXml: string | null = null,
): { nodes: DocxStyleAstNode[]; headerFooterNodes: DocxStyleAstNode[]; setup: DocumentSetup } {
  const { map: styleMap, docDefaultsRPr, defaultParagraphStyleId, tocStyleIds } = parseStyles(stylesXml);
  const themeMap = parseThemeFonts(themeXml);
  const { tagged, finalSectPr } = parseDocumentParagraphs(documentXml);
  const nodes = tagged.map((t) => paragraphToNode(t, styleMap, docDefaultsRPr, themeMap, defaultParagraphStyleId));

  partitionDocumentAst(nodes, finalSectPr, tocStyleIds);

  const setup = extractDocumentSetup(finalSectPr);

  const headerFooterNodes: DocxStyleAstNode[] = [
    ...headerXmls.flatMap((xml) => parseHeaderFooterXml(xml, "header", styleMap, docDefaultsRPr, themeMap, defaultParagraphStyleId)),
    ...footerXmls.flatMap((xml) => parseHeaderFooterXml(xml, "footer", styleMap, docDefaultsRPr, themeMap, defaultParagraphStyleId)),
  ];

  return { nodes, headerFooterNodes, setup };
}
