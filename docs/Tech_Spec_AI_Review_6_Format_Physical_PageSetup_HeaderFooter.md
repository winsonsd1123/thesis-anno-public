# 格式审查物理轨：页面设置、页眉页脚与页码升级方案

## 1. 背景与动机
当前的格式审查“物理轨”已经能够较好地校验正文、标题、图表、参考文献等段落级元素的字体、字号、行距等属性。然而，现有的底层解析（`lib/review/docx-style-ast.ts`）仅仅读取了 `word/document.xml`，并未提取全局的页面边距（`<w:pgMar>`），也没有解析页眉页脚文件（`word/header*.xml`, `word/footer*.xml`）。
这导致当大模型从自然语言规范中抽取了“页面上下边距3.5厘米”或“页码居中”的规则后，规则引擎缺乏底层的“被测物”数据，无法进行实质性的校验。

本方案旨在通过扩展底层的 DOCX 解析能力，并在规则引擎中加入全局比对逻辑，彻底补齐物理轨对“页面设置”和“页眉页脚/页码”的校验能力。

## 2. 核心架构升级计划

升级将分为四个阶段，严格遵循现有代码架构与数据流：
1. **Zip 文件读取扩展**：修改 `readDocxXmlParts` 以提取 `header` 和 `footer` 文件。
2. **AST 解析能力扩建**：解析 `<w:pgMar>`，并复用现有的段落解析逻辑处理页眉页脚内容。
3. **Schema 与规则编译扩展**：扩充 `FormatPhysicalExtract` 与编译后的内部规则表示。
4. **规则引擎校验接入**：在现有的段落级循环之前，执行全局边距检查与页眉页脚合规性检查。

---

## 3. 具体实施步骤与代码级指导

### 3.1. 扩建底层 Zip 提取 (`lib/review/docx-ooxml-zip.ts`)
目前 `readDocxXmlParts` 函数遇到非 `document.xml` 和 `styles.xml` 的文件会直接跳过。我们需要让它收集所有的页眉页脚文件。

**修改点：**
- 修改返回类型，增加 `headerXmls: string[]` 和 `footerXmls: string[]`。
- 在 `zipfile.on("entry")` 中，增加对正则表达式 `^word\/(header|footer)\d+\.xml$` 的匹配。
- 将读取到的内容分别 push 到 `headerXmls` 和 `footerXmls` 数组中。

### 3.2. 升级 AST 类型与结构 (`lib/types/docx-hybrid.ts`)
在统一的数据结构中补充新的上下文与字段。

**修改点：**
1. 扩展 `ParagraphContext` 类型，加入 `"header"` 和 `"footer"`：
   ```typescript
   export type ParagraphContext = "body" | "table_cell" | "caption" | "references" | "footnotes" | "header" | "footer";
   ```
2. 扩展 `DocxStyleAstNode`，增加页码标识：
   ```typescript
   export type DocxStyleAstNode = {
     // ... 现有字段
     /** 是否包含动态页码域（如 <w:fldSimple w:instr=" PAGE ">） */
     has_page_number?: boolean;
   };
   ```
3. 扩展 `HybridDocxParseResult`，增加全局文档设置：
   ```typescript
   export type DocumentSetup = {
     margins?: {
       top_cm?: number;
       bottom_cm?: number;
       left_cm?: number;
       right_cm?: number;
     };
   };

   export type HybridDocxParseResult = {
     // ... 现有字段
     documentSetup?: DocumentSetup;
   };
   ```

### 3.3. 升级 AST 解析器 (`lib/review/docx-style-ast.ts`)
这里的修改分为两部分：提取全局边距，和解析页眉页脚段落。

**修改点 1：抓取页面边距 `<w:pgMar>`**
在解析 `documentXml` 时，定位到 `<w:body><w:sectPr><w:pgMar>`。
提取属性（单位为 twips）：`@_w:top`, `@_w:bottom`, `@_w:left`, `@_w:right`。
添加换算函数：`twipsToCm(twips: number) = twips / 567`。
返回解析出的 `documentSetup.margins`。

**修改点 2：复用 `parseParagraph` 解析页眉页脚**
修改 `buildDocxStyleAst` 函数的签名，接收 `headerXmls` 和 `footerXmls`：
```typescript
export function buildDocxStyleAst(
  documentXml: string,
  stylesXml: string | null,
  headerXmls: string[] = [],
  footerXmls: string[] = []
): { nodes: DocxStyleAstNode[]; setup: DocumentSetup }
```
遍历 `headerXmls` 和 `footerXmls`，调用 `fast-xml-parser` 转换为 JSON，找到里面的 `w:p`，调用现有的 `parseParagraph`。
- 传入 `ctx: "header"` 或 `ctx: "footer"`。
- **页码特判**：在处理 `<w:p>` 时，如果其 JSON 树中存在 `<w:fldSimple>` 且其 `@_w:instr` 属性包含 `"PAGE"`，或者存在 `<w:instrText>` 且内容包含 `"PAGE"`，则在该段落的返回值中标记 `has_page_number: true`。

*注：记得在 `lib/review/hybrid-docx-parser.ts` 中同步更新调用处的传参，将提取到的 `headerXmls` 等传入，并将 `setup` 挂载到最终返回的 `HybridDocxParseResult` 上。*

### 3.4. 扩充 JSON Schema 与编译器 (`lib/schemas/format-physical-extract.schema.ts` & `compile-physical-rules.ts`)

**修改点 1：Schema 补充 (`format-physical-extract.schema.ts`)**
目前 `page_setup` 已经存在，需额外补充：
```typescript
header: PhysicalStyleSchema.optional().describe("页眉格式"),
footer: PhysicalStyleSchema.optional().describe("页脚格式"),
page_number: z.object({
  alignment: z.string().optional().describe("对齐方式，如居中、靠右等"),
  font: z.string().optional().describe("页码字体，如宋体、Times New Roman"),
  size_pt: z.number().optional().describe("页码字号（磅）")
}).optional().describe("页码格式"),
```

**修改点 2：编译器升级 (`compile-physical-rules.ts`)**
在 `PhysicalRuleProgram` 中增加 `global_rules` 字段，用于存放非段落循环比对的全局规则：
```typescript
export type PhysicalRuleProgram = {
  // ... 现有字段
  global_rules: {
    page_setup?: {
      marginTopCm?: number;
      marginBottomCm?: number;
      marginLeftCm?: number;
      marginRightCm?: number;
    };
    header?: CompiledParagraphRule;
    footer?: CompiledParagraphRule;
    page_number?: {
      alignment?: string; // 转换为底层的 "center", "right" 等
      fontAllowlist?: string[];
      sizePt?: number;
    };
  };
};
```
在 `compilePhysicalRules` 函数中，将 `extract.page_setup`, `extract.header`, `extract.footer`, `extract.page_number` 转换为 `global_rules` 结构。

### 3.5. 规则引擎接入校验 (`lib/services/review/format-rules.engine.ts`)
目前引擎主逻辑是一个大循环 `for (let i = 0; i < nodes.length; i++)`。我们需要在循环前后，增加全局的校验。

**修改点：**
引擎函数签名需增加 `documentSetup` 参数：
```typescript
export function runPhysicalRuleEngine(
  nodes: DocxStyleAstNode[],
  program: PhysicalRuleProgram,
  baseline: FormatEngineBaseline,
  documentSetup?: DocumentSetup
): PhysicalLayoutIssue[]
```

1. **边距校验 (`checkPageMargins`)**：
   比对 `documentSetup.margins` 和 `program.global_rules.page_setup`。
   如果差值大于容差（如 `0.15` 厘米），产生 `physical_layout_violation`（严重度 Medium），分析文本写：“期望上边距约 3.5cm，实际 2.8cm”。

2. **页眉页脚校验 (`checkHeaderFooter`)**：
   找出 `nodes.filter(n => n.context === "header")`，如果 `program.global_rules.header` 存在，则调用现有的比对函数（如 `checkFontField`, 字号比对等）。

3. **页码校验 (`checkPageNumber`)**：
   找出 `nodes.filter(n => n.has_page_number)`。
   如果存在，对比其 `paragraph_jc` (对齐方式)、`font_zh`/`font_en`、`size_pt` 是否符合 `program.global_rules.page_number` 的要求。
   如果文档里压根没找到带有 `has_page_number` 的节点，但规则里要求了页码，可酌情报一条“未检测到自动生成的页码”。

## 4. 落地与测试建议
1. 找一个包含页眉页脚、页码，且边距被修改过的 DOCX 文件作为测试用例。
2. 在 `docx-style-ast.test.ts` 中补充对 `<w:pgMar>` 和 `<w:fldSimple w:instr=" PAGE ">` 解析的单测。
3. 确保这个升级**不会**对原本正文轨的 `mammoth.js` Markdown 生成产生任何影响，严格保持 Hybrid 架构的数据隔离。
