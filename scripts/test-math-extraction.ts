/**
 * 诊断脚本：验证 DOCX 公式提取链路各环节。
 *
 * 用法：
 *   npx tsx scripts/test-math-extraction.ts [<文件.docx>]
 *
 * 不带参数时：用合成 OMML 测试 extractMathFragments + appendMathToMarkdown
 * 带 docx 参数时：对真实文件做端到端诊断
 */
import {
  extractMathFragments,
  attachMathToStyleAst,
  appendMathToMarkdown,
} from "../lib/review/docx-math-extractor";

const ATTENTION_OMML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
<w:body>

  <!-- 前文段落 -->
  <w:p>
    <w:r><w:t>自注意力机制的计算公式如下：</w:t></w:r>
  </w:p>

  <!-- 显示公式段落：Attention(Q, K, V) = softmax(QK^T / sqrt(dk)) V -->
  <w:p>
    <m:oMathPara>
      <m:oMath>
        <m:r><m:t>A</m:t></m:r>
        <m:r><m:t>t</m:t></m:r>
        <m:r><m:t>t</m:t></m:r>
        <m:r><m:t>e</m:t></m:r>
        <m:r><m:t>n</m:t></m:r>
        <m:r><m:t>t</m:t></m:r>
        <m:r><m:t>i</m:t></m:r>
        <m:r><m:t>o</m:t></m:r>
        <m:r><m:t>n</m:t></m:r>
        <m:d>
          <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
          <m:e>
            <m:r><m:t>Q</m:t></m:r>
            <m:r><m:t>,</m:t></m:r>
            <m:r><m:t>K</m:t></m:r>
            <m:r><m:t>,</m:t></m:r>
            <m:r><m:t>V</m:t></m:r>
          </m:e>
        </m:d>
        <m:r><m:t>=</m:t></m:r>
        <m:r><m:t>s</m:t></m:r>
        <m:r><m:t>o</m:t></m:r>
        <m:r><m:t>f</m:t></m:r>
        <m:r><m:t>t</m:t></m:r>
        <m:r><m:t>m</m:t></m:r>
        <m:r><m:t>a</m:t></m:r>
        <m:r><m:t>x</m:t></m:r>
        <m:d>
          <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
          <m:e>
            <m:f>
              <m:fPr><m:type m:val="bar"/></m:fPr>
              <m:num>
                <m:r><m:t>Q</m:t></m:r>
                <m:sSup>
                  <m:e><m:r><m:t>K</m:t></m:r></m:e>
                  <m:sup><m:r><m:t>T</m:t></m:r></m:sup>
                </m:sSup>
              </m:num>
              <m:den>
                <m:rad>
                  <m:radPr><m:degHide m:val="1"/></m:radPr>
                  <m:deg/>
                  <m:e>
                    <m:sSub>
                      <m:e><m:r><m:t>d</m:t></m:r></m:e>
                      <m:sub><m:r><m:t>k</m:t></m:r></m:sub>
                    </m:sSub>
                  </m:e>
                </m:rad>
              </m:den>
            </m:f>
          </m:e>
        </m:d>
        <m:r><m:t>V</m:t></m:r>
      </m:oMath>
    </m:oMathPara>
  </w:p>

  <!-- 后续文字 -->
  <w:p>
    <w:r><w:t>其中，Q、K、V分别表示查询</w:t></w:r>
  </w:p>

  <!-- 行内公式示例 -->
  <w:p>
    <w:r><w:t>其中</w:t></w:r>
    <m:oMath>
      <m:r><m:t>Q</m:t></m:r>
      <m:r><m:t>=</m:t></m:r>
      <m:r><m:t>X</m:t></m:r>
      <m:sSub>
        <m:e><m:r><m:t>W</m:t></m:r></m:e>
        <m:sub><m:r><m:t>Q</m:t></m:r></m:sub>
      </m:sSub>
    </m:oMath>
    <w:r><w:t>表示查询向量</w:t></w:r>
  </w:p>

</w:body>
</w:document>`;

function banner(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function testSyntheticOmml() {
  banner("测试 1：合成 Attention OMML → extractMathFragments");

  const frags = extractMathFragments(ATTENTION_OMML);
  console.log(`提取到 ${frags.length} 个含公式段落\n`);

  for (let i = 0; i < frags.length; i++) {
    const f = frags[i];
    console.log(`  [${i}] display=${f.display}  prevText="${f.prevText ?? ""}"  paragraphText="${f.paragraphText}"`);
    for (const tex of f.latex) {
      console.log(`       LaTeX: ${tex}`);
    }
  }

  if (frags.length === 0) {
    console.log("  ⚠ 未提取到任何公式，说明 OMML→MathML→LaTeX 链路异常！");
    return;
  }

  banner("测试 2：attachMathToStyleAst 对齐");
  const styleAst = [
    { text: "自注意力机制的计算公式如下：" },
    { text: "" },
    { text: "其中，Q、K、V分别表示查询" },
    { text: "其中表示查询向量" },
  ];

  const matchCount = attachMathToStyleAst(styleAst, frags);
  console.log(`匹配到 ${matchCount} / ${frags.length} 个公式\n`);
  for (let i = 0; i < styleAst.length; i++) {
    const n = styleAst[i];
    const textPreview = n.text || "(空)";
    const latex = (n as { math_latex?: string[] }).math_latex;
    console.log(`  [${i}] "${textPreview}" → math_latex=${latex ? JSON.stringify(latex) : "undefined"}`);
  }

  banner("测试 3：appendMathToMarkdown 内联插入");
  const fakeMd = [
    "# 第三章 模型设计",
    "",
    "自注意力机制的计算公式如下：",
    "",
    "其中，Q、K、V分别表示查询",
  ].join("\n");

  const finalMd = appendMathToMarkdown(fakeMd, frags);
  console.log("内联插入后的完整 Markdown：\n");
  console.log(finalMd);

  const hasAppendix = finalMd.includes("本文中的数学公式");
  console.log(`\n附录保底：${hasAppendix ? "有（部分公式未匹配）" : "无（全部公式已内联）"}`);
}

async function testRealDocx(filePath: string) {
  const { readFileSync } = await import("node:fs");
  const { readDocxXmlParts } = await import("../lib/review/docx-ooxml-zip");

  banner(`真实 DOCX 诊断：${filePath}`);

  const buf = readFileSync(filePath);

  banner("步骤 1：从 OOXML 提取 document.xml 中的公式");
  const { documentXml } = await readDocxXmlParts(buf);
  const frags = extractMathFragments(documentXml);
  console.log(`提取到 ${frags.length} 个含公式段落，共 ${frags.reduce((n, f) => n + f.latex.length, 0)} 条 LaTeX\n`);

  for (let i = 0; i < frags.length; i++) {
    const f = frags[i];
    const ctxSnippet = f.paragraphText.trim().slice(0, 50);
    console.log(`  [${i}] display=${f.display}  ctx="${ctxSnippet || "(空段落)"}"`);
    for (const tex of f.latex) {
      const texPreview = tex.length > 80 ? tex.slice(0, 80) + "…" : tex;
      console.log(`       LaTeX: ${texPreview}`);
    }
  }

  if (frags.length === 0) {
    console.log("\n  ⚠ document.xml 中未检测到 m:oMath/m:oMathPara 节点！");
    console.log("  可能原因：");
    console.log("    1. DOCX 中的公式是图片形式（非 OMML 原生公式）");
    console.log("    2. DOCX 中使用了 MathType 等第三方公式编辑器（不产生 OMML）");
    console.log("    3. 公式是纯文本输入（非插入公式对象）");
    console.log("  下一步：请在 Word 中打开此文件，点击公式查看是否可编辑。");
    console.log("  如果公式不可编辑，说明它是图片而非 OMML 对象。");
    return;
  }

  banner("步骤 2：Mammoth Markdown 与公式附录对比");
  const mammoth = await import("mammoth");
  const mdRes = await mammoth.default.convertToMarkdown({ buffer: buf });
  const rawMd = mdRes.value;

  console.log(`Mammoth Markdown 长度: ${rawMd.length} 字符`);
  console.log(`Mammoth 警告消息: ${mdRes.messages.length} 条\n`);

  if (mdRes.messages.length > 0) {
    for (const msg of mdRes.messages.slice(0, 10)) {
      console.log(`  [${msg.type}] ${msg.message}`);
    }
  }

  for (const frag of frags) {
    const ctx = frag.paragraphText.trim();
    if (ctx.length > 0) {
      const found = rawMd.includes(ctx);
      console.log(`  公式上下文 "${ctx.slice(0, 40)}…" 在 Mammoth MD 中${found ? "✅ 存在" : "❌ 不存在"}`);
    }
  }

  const finalMd = appendMathToMarkdown(rawMd, frags);
  const appendixStart = finalMd.indexOf("---\n本文中的数学公式");
  if (appendixStart >= 0) {
    console.log("\n公式附录内容：");
    console.log(finalMd.slice(appendixStart));
  }

  banner("步骤 3：styleAst 公式对齐检查");
  const { buildDocxStyleAst } = await import("../lib/review/docx-style-ast");
  const { stylesXml, headerXmls, footerXmls } = await readDocxXmlParts(buf);
  const { nodes: styleAst } = buildDocxStyleAst(documentXml, stylesXml, headerXmls, footerXmls);
  const matchCount = attachMathToStyleAst(styleAst, frags);
  console.log(`styleAst 共 ${styleAst.length} 个段落，公式匹配成功 ${matchCount} / ${frags.length}\n`);

  const mathNodes = styleAst.filter((n) => n.math_latex && n.math_latex.length > 0);
  for (const n of mathNodes) {
    const textPreview = n.text.trim().slice(0, 40) || "(空段落)";
    console.log(`  段落 "${textPreview}" → math_latex=${JSON.stringify(n.math_latex)}`);
  }

  const unmatched = frags.length - matchCount;
  if (unmatched > 0) {
    console.log(`\n  ⚠ ${unmatched} 个公式未能匹配到 styleAst 段落！`);
    console.log("  可能原因：paragraphText 与 styleAst.text 文本不一致");
  }

  banner("步骤 4：LaTeX 质量检查");
  let warnCount = 0;
  for (const frag of frags) {
    for (const tex of frag.latex) {
      if (tex.includes("\\begin{") || tex.includes("\\end{")) {
        console.log(`  ⚠ LaTeX 含 \\begin/\\end 环境: ${tex.slice(0, 60)}…`);
        warnCount++;
      }
      if (tex.length > 500) {
        console.log(`  ⚠ LaTeX 过长 (${tex.length} 字符): ${tex.slice(0, 60)}…`);
        warnCount++;
      }
      const braces = (tex.match(/\{/g) || []).length - (tex.match(/\}/g) || []).length;
      if (braces !== 0) {
        console.log(`  ⚠ LaTeX 花括号不平衡 (差 ${braces}): ${tex.slice(0, 60)}…`);
        warnCount++;
      }
    }
  }
  if (warnCount === 0) {
    console.log("  ✅ LaTeX 基础检查均通过");
  }

  banner("步骤 5：Markdown 分块与公式可见性");
  const { splitMarkdownByChapters } = await import("../lib/review/format-markdown-chunks");
  const chunks = splitMarkdownByChapters(finalMd);
  console.log(`Markdown 被分为 ${chunks.length} 个 chunks\n`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const hasAppendix = chunk.includes("本文中的数学公式");
    const hasDollar = chunk.includes("$");
    const preview = chunk.slice(0, 60).replace(/\n/g, "↵");
    console.log(`  chunk[${i}] len=${chunk.length}  有附录=${hasAppendix}  有$=${hasDollar}  "${preview}…"`);
  }

  console.log("\n关键问题：公式附录是否在最后一个 chunk 中？");
  const lastChunk = chunks[chunks.length - 1];
  if (lastChunk.includes("本文中的数学公式")) {
    console.log("  ✅ 附录在最后一个 chunk 中");
    console.log("  ⚠ 但如果公式出现在前面的 chunk 段落中（如'计算公式如下：'），");
    console.log("    该 chunk 看不到附录，LLM 可能误报'缺少公式'");
  } else {
    console.log("  ❌ 附录不在最后一个 chunk 中（可能 Markdown 太长被截断）");
  }
}

void (async () => {
  const filePath = process.argv[2];

  testSyntheticOmml();

  if (filePath) {
    await testRealDocx(filePath);
  } else {
    console.log("\n提示：传入 DOCX 文件路径可做端到端诊断");
    console.log("  npx tsx scripts/test-math-extraction.ts your-thesis.docx");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
