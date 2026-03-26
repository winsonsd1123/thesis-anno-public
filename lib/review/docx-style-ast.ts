import { XMLParser } from "fast-xml-parser";
import type { DocxStyleAstNode, ParagraphContext, RunSpan } from "@/lib/types/docx-hybrid";

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

type StyleDef = {
  rPr: RPrParts;
  basedOn?: string;
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

type ParsedStyles = {
  map: Map<string, StyleDef>;
  /** w:docDefaults/w:rPrDefault/w:rPr — 文档级默认字号/字体 */
  docDefaultsRPr: RPrParts;
};

function parseStyles(stylesXml: string | null): ParsedStyles {
  const map = new Map<string, StyleDef>();
  const empty: ParsedStyles = { map, docDefaultsRPr: {} };
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
    map.set(id, {
      rPr: extractRPr(so.rPr),
      basedOn: extractBasedOn(so),
    });
  }
  return { map, docDefaultsRPr };
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

function pickFont(r: RPrParts): string | undefined {
  return r.fontEastAsia || r.fontAscii;
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

function inferCaptionContext(pStyleId: string | undefined, text: string): boolean {
  if (pStyleId) {
    const low = pStyleId.toLowerCase();
    for (const s of CAPTION_STYLE_SUBSTRINGS) {
      if (low.includes(s.toLowerCase())) return true;
    }
  }
  if (CAPTION_TEXT_RE.test(text.trim())) return true;
  return false;
}

function parseDocumentParagraphs(documentXml: string): TaggedParagraph[] {
  const doc = parser.parse(documentXml) as Record<string, unknown>;
  const root = doc.document ?? doc;
  if (!root || typeof root !== "object") return [];
  const body = (root as Record<string, unknown>).body;
  if (!body) return [];
  const paragraphs: TaggedParagraph[] = [];
  collectParagraphElements(body, paragraphs, false);
  return paragraphs;
}

function rprToRunSpan(text: string, rpr: RPrParts): RunSpan {
  return {
    text,
    font: pickFont(rpr),
    size_pt: rpr.sizeHalfPoints !== undefined ? rpr.sizeHalfPoints / 2 : undefined,
    bold: rpr.bold,
    italic: rpr.italic,
  };
}

function paragraphToNode(
  tagged: TaggedParagraph,
  styleMap: Map<string, StyleDef>,
  docDefaultsRPr: RPrParts,
): DocxStyleAstNode {
  const p = tagged.raw;
  const pStyleId = getPStyleId(p);
  const rawRuns = ensureArray((p as Record<string, unknown>).r);

  const spans: RunSpan[] = [];
  for (const run of rawRuns) {
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
  if (ctx === "body" && inferCaptionContext(pStyleId, text)) {
    ctx = "caption";
  }

  return {
    text,
    font: dominant?.font ?? pickFont(fallbackRPr),
    size_pt: dominant?.size_pt ?? (fallbackRPr.sizeHalfPoints !== undefined ? fallbackRPr.sizeHalfPoints / 2 : undefined),
    bold: dominant?.bold ?? fallbackRPr.bold,
    italic: dominant?.italic ?? fallbackRPr.italic,
    paragraphStyleId: pStyleId,
    characterStyleId: rawRuns[0] ? getRStyleId(rawRuns[0]) : undefined,
    runs: spans.length > 0 ? spans : undefined,
    context: ctx,
  };
}

/**
 * 从 `document.xml` + `styles.xml` 构建段落级样式 AST（quote_text + 字体/字号等）。
 */
export function buildDocxStyleAst(documentXml: string, stylesXml: string | null): DocxStyleAstNode[] {
  const { map: styleMap, docDefaultsRPr } = parseStyles(stylesXml);
  const tagged = parseDocumentParagraphs(documentXml);
  return tagged.map((t) => paragraphToNode(t, styleMap, docDefaultsRPr));
}
