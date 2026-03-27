import test from "node:test";
import assert from "node:assert/strict";
import { buildDocxStyleAst } from "@/lib/review/docx-style-ast";

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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
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
  const nodes = buildDocxStyleAst(documentXml, stylesXml);
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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
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
  const nodes = buildDocxStyleAst(documentXml, stylesXml);
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
  const nodes = buildDocxStyleAst(documentXml, STYLES_EMPTY);
  assert.equal(nodes[0].outlineLevel, 0);
  assert.equal(nodes[0].context, "body");
});
