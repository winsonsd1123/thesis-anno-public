/**
 * 本地验收 / 诊断：npx tsx scripts/smoke-hybrid-docx.ts <文件.docx> [--dump-ast]
 *
 *   --dump-ast  输出完整 styleAst（含每个段落的 text, font, size_pt, bold, paragraphStyleId）
 */
import { readFileSync } from "node:fs";
import { parseHybridDocx } from "../lib/review/hybrid-docx-parser";
import { readDocxXmlParts } from "../lib/review/docx-ooxml-zip";
import { XMLParser } from "fast-xml-parser";

const filePath = process.argv[2];
const dumpAst = process.argv.includes("--dump-ast");

if (!filePath) {
  console.error("用法: npx tsx scripts/smoke-hybrid-docx.ts <文件.docx> [--dump-ast]");
  process.exit(1);
}

function dumpDocDefaults(stylesXml: string | null) {
  if (!stylesXml) {
    console.log("\n⚠ styles.xml 不存在，无法读取 docDefaults");
    return;
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    textNodeName: "#text",
    trimValues: false,
  });
  const doc = parser.parse(stylesXml) as Record<string, unknown>;
  const stylesRoot = doc.styles as Record<string, unknown> | undefined;
  if (!stylesRoot) {
    console.log("\n⚠ styles.xml 无 <w:styles> 根节点");
    return;
  }
  const dd = stylesRoot.docDefaults;
  console.log("\n=== docDefaults ===");
  console.log(JSON.stringify(dd, null, 2));
}

function dumpStyleDefinitions(stylesXml: string | null) {
  if (!stylesXml) return;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    textNodeName: "#text",
    trimValues: false,
  });
  const doc = parser.parse(stylesXml) as Record<string, unknown>;
  const stylesRoot = doc.styles as Record<string, unknown> | undefined;
  if (!stylesRoot) return;
  const styles = stylesRoot.style;
  const arr = Array.isArray(styles) ? styles : styles ? [styles] : [];
  console.log(`\n=== styles.xml 样式定义 (共 ${arr.length} 条，仅显示前 15) ===`);
  for (const s of arr.slice(0, 15)) {
    if (!s || typeof s !== "object") continue;
    const so = s as Record<string, unknown>;
    const id = Object.entries(so).find(([k]) => k.startsWith("@_") && k.toLowerCase().includes("styleid"))?.[1];
    const type = Object.entries(so).find(([k]) => k.startsWith("@_") && k.toLowerCase().includes("type"))?.[1];
    const name = so.name ? JSON.stringify(so.name) : "?";
    const rPr = so.rPr ? JSON.stringify(so.rPr) : "–";
    console.log(`  [${type}] id="${id}"  name=${name}  rPr=${rPr}`);
  }
}

void (async () => {
  const buf = readFileSync(filePath);
  const r = await parseHybridDocx(buf);
  console.log("markdown.length", r.markdown.length);
  console.log("styleAst.length", r.styleAst.length);
  console.log("mammothMessages", r.mammothMessages.length);
  console.log("images.length", r.images.length);
  console.log("imagesSkipped", r.imagesSkipped);
  if (r.images.length > 0) {
    const maxB64 = Math.max(...r.images.map((i) => i.dataBase64.length));
    console.log("max image base64 length (chars)", maxB64);
  }

  const { stylesXml } = await readDocxXmlParts(buf);
  dumpDocDefaults(stylesXml);
  dumpStyleDefinitions(stylesXml);

  if (dumpAst) {
    console.log("\n=== 完整 styleAst ===");
    for (let i = 0; i < r.styleAst.length; i++) {
      const n = r.styleAst[i];
      const textPreview = n.text.trim().slice(0, 60);
      if (!textPreview) continue;
      const ctxTag = n.context && n.context !== "body" ? ` [${n.context}]` : "";
      console.log(
        `  [${i}] style="${n.paragraphStyleId ?? "–"}" font_zh="${n.font_zh ?? "–"}" font_en="${n.font_en ?? "–"}" size=${n.size_pt ?? "–"}pt bold=${n.bold ?? "–"}${ctxTag}  「${textPreview}」`
      );
      if (n.runs && n.runs.length > 1) {
        for (let j = 0; j < n.runs.length; j++) {
          const run = n.runs[j];
          const rt = run.text.trim().slice(0, 40);
          if (!rt) continue;
          console.log(
            `      run[${j}] font_zh="${run.font_zh ?? "–"}" font_en="${run.font_en ?? "–"}" size=${run.size_pt ?? "–"}pt bold=${run.bold ?? "–"}  「${rt}」`
          );
        }
      }
    }
  } else {
    console.log("\nstyleAst[0..4]", JSON.stringify(r.styleAst.slice(0, 5), null, 2));
    console.log("\n提示: 加 --dump-ast 查看完整段落列表");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
