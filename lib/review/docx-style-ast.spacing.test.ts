import test from "node:test";
import assert from "node:assert/strict";
import { buildDocxStyleAst, parseThemeFonts } from "@/lib/review/docx-style-ast";

const STYLES_EMPTY = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>`;

test("buildDocxStyleAst: w:spacing exact line + before/after twips, w:ind firstLineChars", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:spacing w:before="200" w:after="120" w:line="480" w:lineRule="exact"/>
        <w:ind w:firstLineChars="200"/>
      </w:pPr>
      <w:r><w:t>正文第一段</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.line_spacing_pt, 24);
  assert.equal(n.space_before_pt, 10);
  assert.equal(n.space_after_pt, 6);
  assert.equal(n.indent_first_line_chars, 2);
});

test("buildDocxStyleAst: w:lineRule auto → line_spacing_multiple", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto"/>
      </w:pPr>
      <w:r><w:t>x</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes[0].line_spacing_multiple, 1.5);
});

test("buildDocxStyleAst: style chain merges spacing into paragraph", () => {
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="MyBody">
    <w:pPr>
      <w:spacing w:line="240" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
</w:styles>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="MyBody"/>
        <w:ind w:firstLine="240"/>
      </w:pPr>
      <w:r><w:t>继承行距与直接首行</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, stylesXml);
  assert.equal(nodes[0].line_spacing_multiple, 1);
  assert.equal(nodes[0].indent_first_line_pt, 12);
});

test("buildDocxStyleAst: w:jc center + weak hint → context caption", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>系统架构示意图说明</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].paragraph_jc, "center");
  assert.equal(nodes[0].context, "caption");
});

test("buildDocxStyleAst: centered long paragraph with weak hint stays body (avoid false caption)", () => {
  const long = "本段为误居中的正文".repeat(12);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>${long}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes[0].context, "body");
});

test("buildDocxStyleAst: 注： prefix → caption without center", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>注：本表数据来源于公开数据集。</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes[0].context, "caption");
});

test("buildDocxStyleAst: style chain inherits jc center", () => {
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="CapLike">
    <w:pPr><w:jc w:val="center"/></w:pPr>
  </w:style>
</w:styles>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="CapLike"/></w:pPr>
      <w:r><w:t>实验结果对比表</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, stylesXml);
  assert.equal(nodes[0].paragraph_jc, "center");
  assert.equal(nodes[0].context, "caption");
});

test("buildDocxStyleAst: outline heading centered is not caption via weak hint", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:outlineLvl w:val="0"/>
      </w:pPr>
      <w:r><w:t>示意图章节标题勿当题注</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes[0].outlineLevel, 0);
  assert.equal(nodes[0].context, "body");
});

// ── 新增测试：pgMar 解析、页码域检测、页眉页脚隔离 ──────────────────────────

test("buildDocxStyleAst: sectPr/pgMar → setup.margins 正确换算 cm", () => {
  // top=1985 twips ≈ 3.50cm, bottom=1985, left=1701≈3.00cm, right=1701
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>正文</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgMar w:top="1985" w:bottom="1985" w:left="1701" w:right="1701"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  const { setup } = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.ok(setup.margins, "margins 应存在");
  assert.ok(Math.abs((setup.margins!.top_cm ?? 0) - 1985 / 567) < 0.01, "top_cm 换算误差 < 0.01");
  assert.ok(Math.abs((setup.margins!.left_cm ?? 0) - 1701 / 567) < 0.01, "left_cm 换算误差 < 0.01");
});

test("buildDocxStyleAst: 页眉含 fldSimple[@instr=PAGE] → has_page_number:true", () => {
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:fldSimple w:instr=" PAGE ">
      <w:r><w:t>1</w:t></w:r>
    </w:fldSimple>
  </w:p>
</w:hdr>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body>
</w:document>`;
  const { headerFooterNodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY, [headerXml], []);
  assert.ok(headerFooterNodes.length > 0, "页眉节点数 > 0");
  const pageNode = headerFooterNodes.find((n) => n.has_page_number);
  assert.ok(pageNode, "应有 has_page_number:true 节点");
  assert.equal(pageNode?.context, "header");
});

test("buildDocxStyleAst: 页眉节点在 headerFooterNodes 中，不出现在 nodes 中", () => {
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>页眉文字</w:t></w:r></w:p>
</w:hdr>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>正文段落</w:t></w:r></w:p></w:body>
</w:document>`;
  const { nodes, headerFooterNodes } = buildDocxStyleAst(documentXml, STYLES_EMPTY, [headerXml], []);
  assert.equal(headerFooterNodes.length, 1);
  assert.equal(headerFooterNodes[0].context, "header");
  assert.equal(headerFooterNodes[0].text, "页眉文字");
  // nodes 中不应含 header context
  assert.ok(!nodes.some((n) => n.context === "header"), "nodes 中不应出现 header context");
});

// ────────────────────────────── theme font tests ──────────────────────────────

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">
  <a:themeElements>
    <a:fontScheme name="Office">
      <a:majorFont>
        <a:latin a:typeface="Calibri Light"/>
        <a:ea a:typeface="黑体"/>
      </a:majorFont>
      <a:minorFont>
        <a:latin a:typeface="Calibri"/>
        <a:ea a:typeface="宋体"/>
      </a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;

test("parseThemeFonts: extracts major/minor ea and latin from theme XML", () => {
  const map = parseThemeFonts(THEME_XML);
  assert.equal(map.majorEastAsia, "黑体");
  assert.equal(map.minorEastAsia, "宋体");
  assert.equal(map.majorAscii, "Calibri Light");
  assert.equal(map.minorAscii, "Calibri");
});

test("parseThemeFonts: returns empty map for null input", () => {
  const map = parseThemeFonts(null);
  assert.equal(map.majorEastAsia, undefined);
  assert.equal(map.minorEastAsia, undefined);
});

test("parseThemeFonts: falls back to script=Hans when ea typeface is empty", () => {
  const themeWithEmptyEa = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">
  <a:themeElements>
    <a:fontScheme name="Office">
      <a:majorFont>
        <a:latin a:typeface="Calibri Light"/>
        <a:ea a:typeface=""/>
        <a:font a:script="Hans" a:typeface="等线 Light"/>
      </a:majorFont>
      <a:minorFont>
        <a:latin a:typeface="Calibri"/>
        <a:ea a:typeface=""/>
        <a:font a:script="Hans" a:typeface="等线"/>
      </a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;
  const map = parseThemeFonts(themeWithEmptyEa);
  assert.equal(map.majorEastAsia, "等线 Light", "should fallback to Hans script");
  assert.equal(map.minorEastAsia, "等线", "should fallback to Hans script");
  assert.equal(map.majorAscii, "Calibri Light");
  assert.equal(map.minorAscii, "Calibri");
});

test("buildDocxStyleAst: theme font resolves eastAsiaTheme to actual font name", () => {
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:eastAsiaTheme="minorEastAsia" w:asciiTheme="minorHAnsi"/>
        <w:sz w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>这是正文段落</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, stylesXml, [], [], THEME_XML);
  assert.equal(nodes[0].font_zh, "宋体", "should resolve minorEastAsia to 宋体");
  assert.equal(nodes[0].font_en, "Calibri", "should resolve minorHAnsi to Calibri");
});

test("buildDocxStyleAst: explicit eastAsia takes precedence over eastAsiaTheme", () => {
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:eastAsia="楷体" w:eastAsiaTheme="minorEastAsia"/>
        <w:sz w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>楷体正文</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, stylesXml, [], [], THEME_XML);
  assert.equal(nodes[0].font_zh, "楷体", "explicit eastAsia should win over theme");
});

test("buildDocxStyleAst: multi-run paragraph resolves theme font per run", () => {
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:eastAsiaTheme="minorEastAsia"/>
        <w:sz w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>关键词：</w:t></w:r>
      <w:r><w:t>这是一段较长的关键词内容文本</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const { nodes } = buildDocxStyleAst(documentXml, stylesXml, [], [], THEME_XML);
  assert.ok(nodes[0].runs, "should have runs");
  for (const run of nodes[0].runs!) {
    assert.equal(run.font_zh, "宋体", `run "${run.text}" should resolve to 宋体`);
  }
});
