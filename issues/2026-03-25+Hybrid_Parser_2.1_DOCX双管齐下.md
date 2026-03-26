# 工作日志：Hybrid Parser 2.1（DOCX 双管齐下）

**日期**：2026-03-25  
**范围**：依据 [Tech_Spec_AI_Review_4_DOCX_Migration.md](docs/Tech_Spec_AI_Review_4_DOCX_Migration.md) 第 2.1 节，实现统一解析层（Mammoth Markdown 主干 + OOXML 样式 AST 侧枝）

---

## 背景与目标

- 在 Trigger 审阅管线中，**调用 LLM 前**需经过统一解析层；本迭代交付 **可复用的解析模块与类型**，**不**改编排器 `review-orchestrator`（属文档第 3 章）。
- **内容主干**：`mammoth.convertToMarkdown`，作为后续逻辑 / AI 痕迹 / 参考文献审阅的 Markdown 输入源。
- **样式侧枝**：`yauzl` 仅按需读取 `word/document.xml`、`word/styles.xml`（防 OOM，不展开 `word/media/`）；`fast-xml-parser` 构建段落级 `styleAst`，含 `text`（quote_text）、`font`、`size_pt`、样式继承等。
- **计费**：`countWordsFromDocxBuffer` 仍使用 `extractRawText`，与本路径解耦，避免字数口径静默分叉。

---

## 主要改动（文件级）

| 模块 | 说明 |
|------|------|
| `lib/review/docx-ooxml-zip.ts` | `readDocxXmlParts`：yauzl 流式按 entry 读取两份 XML，单文件上限 20MB。 |
| `lib/review/docx-style-ast.ts` | `buildDocxStyleAst`：段落级节点、`w:sz`/`rFonts`、`pStyle`/`rStyle` 与 `styles.xml` 中 `basedOn` 链合并。 |
| `lib/review/hybrid-docx-parser.ts` | `parseHybridDocx`：`Promise.allSettled` 并行 Markdown 与 OOXML；错误前缀 `HYBRID_DOCX_MARKDOWN` / `STYLE_XML` / `STYLE_AST`。 |
| `lib/types/docx-hybrid.ts` | `HybridDocxParseResult`、`DocxStyleAstNode`、`MammothMessage`。 |
| `lib/types/review.ts` | 再导出上述 docx-hybrid 类型。 |
| `types/mammoth.d.ts` | 补齐 mammoth 的 `convertToMarkdown` 等声明；`tsconfig.json` 增加 `types/**/*.d.ts`。 |
| `package.json` | 依赖 `yauzl`、`fast-xml-parser`；dev `@types/yauzl`；脚本 `smoke:hybrid-docx`。 |
| `scripts/smoke-hybrid-docx.ts` | 本地冒烟：对给定 `.docx` 打印 markdown 长度与 `styleAst` 样例。 |
| `fixtures/minimal-hybrid-docx/`、`fixtures/minimal-hybrid.docx` | 最小 OOXML 固件，便于验收解析结果。 |

---

## 验证

- `npm run build` 已通过。
- `npm run smoke:hybrid-docx -- fixtures/minimal-hybrid.docx` 已验证：段落文本、字号、字体与 `paragraphStyleId` 输出符合预期。

---

## 后续（不在本日志范围）

- 文档 **2.2** 图片流式处理、`sharp`、多模态注入。
- **第 3 章**：`orchestrate-review` 下载 DOCX、`parseHybridDocx` 注入各引擎入参（`markdownText` + `styleAST` + 后续 `imageDictionary`）。
