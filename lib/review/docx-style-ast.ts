import { XMLParser } from "fast-xml-parser";
import type { DocxStyleAstNode, ParagraphContext, RunSpan, DocumentPartition } from "@/lib/types/docx-hybrid";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
  trimValues: false,
});

type RPrParts = {
  fontEastAsia?: string;
  fontAscii?: string;
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
  for (const key of ["sz", "szCs"]) {
    for (const s of ensureArray(o[key])) {
      if (s && typeof s === "object") {
        const v = pickAttrVal(s as Record<string, unknown>);
        if (v) {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n)) sizeHalfPoints = n;
        }
      }
    }
  }
  let fontEastAsia: string | undefined;
  let fontAscii: string | undefined;
  const rf = o.rFonts;
  if (rf && typeof rf === "object") {
    const rfo = rf as Record<string, unknown>;
    fontEastAsia = pickFontAttr(rfo, "eastAsia", "eastasia");
    fontAscii = pickFontAttr(rfo, "ascii", "hAnsi", "hansi");
  }
  return {
    fontEastAsia,
    fontAscii,
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

  for (const st of ensureArray(stylesRoot.style)) {
    if (!st || typeof st !== "object") continue;
    const so = st as Record<string, unknown>;
    const id = getStyleIdFromElement(so);
    if (!id) continue;
    const styleName = getStyleNameVal(so);
    if (styleName && /^toc\b/i.test(styleName.trim())) {
      tocStyleIds.add(id);
    }
    map.set(id, {
      rPr: extractRPr(so.rPr),
      basedOn: extractBasedOn(so),
      outlineLvl: getOutlineLevel(so.pPr),
      jcVal: extractJcValFromPPr(so.pPr),
      spacingInd: extractSpacingIndFromPPr(so.pPr),
    });
  }
  return { map, docDefaultsRPr, tocStyleIds };
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
  const charRpr = rStyleId ? getStyleRPrResolved(rStyleId, styleMap, docDefaultsRPr) : {};
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
  // 真正的题注通常很短（图/表名），正文引图句即使以「图5-2」开头也远超此阈值
  const CAPTION_TEXT_MAX_CHARS = 30;
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

function rprToRunSpan(text: string, rpr: RPrParts): RunSpan {
  return {
    text,
    font_zh: rpr.fontEastAsia,
    font_en: rpr.fontAscii,
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
): InternalAstNode {
  const p = tagged.raw;
  const pStyleId = getPStyleId(p);
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
    spans.push(rprToRunSpan(runText, eff));
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
    font_zh: dominant?.font_zh ?? fallbackRPr.fontEastAsia,
    font_en: dominant?.font_en ?? fallbackRPr.fontAscii,
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
 * 从 `document.xml` + `styles.xml` 构建段落级样式 AST（quote_text + 字体/字号等）。
 * 并在后扫描阶段完成全局区段切分 (Partitioning)。
 */
export function buildDocxStyleAst(documentXml: string, stylesXml: string | null): DocxStyleAstNode[] {
  const { map: styleMap, docDefaultsRPr, tocStyleIds } = parseStyles(stylesXml);
  const { tagged, finalSectPr } = parseDocumentParagraphs(documentXml);
  const nodes = tagged.map((t) => paragraphToNode(t, styleMap, docDefaultsRPr));

  partitionDocumentAst(nodes, finalSectPr, tocStyleIds);

  return nodes;
}
