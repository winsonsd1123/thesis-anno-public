# 格式审查物理轨：页面设置、页眉页脚与页码升级方案

## 1. 背景与动机
当前的格式审查"物理轨"已经能够较好地校验正文、标题、图表、参考文献等段落级元素的字体、字号、行距等属性。然而，现有的底层解析（`lib/review/docx-style-ast.ts`）仅仅读取了 `word/document.xml`，并未提取全局的页面边距（`<w:pgMar>`），也没有解析页眉页脚文件（`word/header*.xml`, `word/footer*.xml`）。
这导致当大模型从自然语言规范中抽取了"页面上下边距3.5厘米"或"页码居中"的规则后，规则引擎缺乏底层的"被测物"数据，无法进行实质性的校验。

本方案旨在通过扩展底层的 DOCX 解析能力，并在规则引擎中加入全局比对逻辑，彻底补齐物理轨对"页面设置"和"页眉页脚/页码"的校验能力。

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
3. 新增 `DocumentSetup` 类型，并在 `HybridDocxParseResult` 中补充两个独立字段：
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
     /**
      * 页眉页脚段落节点（独立存放，不混入 styleAst）。
      * 与 styleAst 隔离，避免 partitionDocumentAst 对其产生干扰。
      */
     headerFooterAst?: DocxStyleAstNode[];
   };
   ```

   > **架构说明**：页眉页脚节点必须单独存放于 `headerFooterAst`，而非追加到 `styleAst`。原因：`partitionDocumentAst` 会对 `styleAst` 所有节点顺序遍历并赋 `partition`，页眉页脚节点没有 `sectPr`/`_isPageReset` 标记，混入后会被错误标记为 `"front_cover"`，引发难以追踪的误判。

### 3.3. 升级 AST 解析器 (`lib/review/docx-style-ast.ts`)
这里的修改分为两部分：提取全局边距，和解析页眉页脚段落。

**修改点 1：抓取页面边距 `<w:pgMar>`**
在解析 `documentXml` 时，定位到 `<w:body><w:sectPr><w:pgMar>`（body 级 sectPr，即 `finalSectPr`）。
提取属性（单位为 twips）：`@_top`, `@_bottom`, `@_left`, `@_right`。

> **注意**：当前 `fast-xml-parser` 的配置为 `removeNSPrefix: true`，会同时剥除属性的命名空间前缀，因此 `w:top` 解析后属性键为 `@_top`，**而非** `@_w:top`。所有属性读取须统一使用去前缀形式。

添加换算函数：`twipsToCm(twips: number) = twips / 567`（1 cm ≈ 566.93 twips，取整近似）。
返回解析出的 `documentSetup.margins`。

**修改点 2：解析页眉页脚段落**
修改 `buildDocxStyleAst` 函数的签名，接收 `headerXmls` 和 `footerXmls`，并返回独立的 `headerFooterNodes` 数组：
```typescript
export function buildDocxStyleAst(
  documentXml: string,
  stylesXml: string | null,
  headerXmls: string[] = [],
  footerXmls: string[] = []
): { nodes: DocxStyleAstNode[]; headerFooterNodes: DocxStyleAstNode[]; setup: DocumentSetup }
```
遍历 `headerXmls` 和 `footerXmls`，调用 `fast-xml-parser` 转换为 JSON，找到里面的 `w:p`，复用内部的 `paragraphToNode` 处理管线。
- 以 `ctx: "header"` 或 `ctx: "footer"` 作为 `TaggedParagraph.context` 传入。
- 这些节点**不追加到 body `nodes` 数组**，而是单独收集到 `headerFooterNodes` 返回。
- **页码特判**：在处理页眉页脚的 `<w:p>` 时，若 JSON 树中存在 `fldSimple`（`removeNSPrefix` 后无 `w:` 前缀）且其 `@_instr` 属性包含 `"PAGE"`，或者存在 `instrText` 元素且内容包含 `"PAGE"`，则将该段落节点的 `has_page_number` 标记为 `true`。

*注：以下所有调用方均需同步更新：*
- *`lib/review/hybrid-docx-parser.ts`：解构新返回值 `{ nodes, headerFooterNodes, setup }`，将 `headerFooterNodes` 挂载为 `HybridDocxParseResult.headerFooterAst`，将 `setup` 挂载为 `documentSetup`。*
- *`lib/review/docx-style-ast.spacing.test.ts`：测试中对返回值的使用需同步适配。*
- *`scripts/simulate-physical-on-docx.ts`：同上。*

### 3.4. 扩充 JSON Schema 与编译器 (`lib/schemas/format-physical-extract.schema.ts` & `compile-physical-rules.ts`)

**修改点 1：Schema 补充 (`format-physical-extract.schema.ts`)**
目前 `page_setup` 已经存在，需额外补充。`header`/`footer` 直接复用已有的 `PhysicalStyleSchema`；`page_number` 同样复用 `PhysicalStyleSchema`（包含 `font_zh`/`font_en` 与枚举 `alignment`），无需重新定义字段：
```typescript
header: PhysicalStyleSchema.optional().describe("页眉格式"),
footer: PhysicalStyleSchema.optional().describe("页脚格式"),
// page_number 复用 PhysicalStyleSchema，保持 font_zh/font_en 分离与 alignment 枚举一致
page_number: PhysicalStyleSchema.optional().describe("页码格式（对齐、字体、字号）"),
```

> **设计说明**：早期草案曾为 `page_number` 定义含单一 `font` 字段的独立对象，这与全库 `font_zh`/`font_en` 分离的约定冲突，且 `alignment: z.string()` 也比既有的 `z.enum(["left","center","right","justify"])` 宽松。此处统一复用 `PhysicalStyleSchema` 以消除不一致。

**修改点 2：编译器升级 (`compile-physical-rules.ts`)**
新增轻量样式规则类型 `CompiledStyleRule`（省去对全局规则无意义的 `match` 字段），并在 `PhysicalRuleProgram` 中增加 `global_rules` 字段：
```typescript
/** 全局样式规则（无需 match，已知作用域为 header/footer/page_number） */
export type CompiledStyleRule = {
  id: string;
  fontAllowlistZh?: string[];
  fontAllowlistEn?: string[];
  sizePt?: number;
  bold?: boolean;
  lineSpacingPt?: number;
  lineSpacingMultiple?: number;
  alignmentVal?: string; // 底层值："center" | "right" | "left" | "both"
};

export type PhysicalRuleProgram = {
  // ... 现有字段
  global_rules: {
    page_setup?: {
      marginTopCm?: number;
      marginBottomCm?: number;
      marginLeftCm?: number;
      marginRightCm?: number;
    };
    header?: CompiledStyleRule;
    footer?: CompiledStyleRule;
    page_number?: CompiledStyleRule;
  };
};
```
在 `compilePhysicalRules` 函数中，将 `extract.page_setup`、`extract.header`、`extract.footer`、`extract.page_number` 转换为 `global_rules` 结构，`alignment` 枚举值直接映射（`"center"` → `"center"`，`"right"` → `"right"` 等）。

### 3.5. 规则引擎接入校验 (`lib/services/review/format-rules.engine.ts`)
目前引擎主逻辑是一个大循环 `for (let i = 0; i < nodes.length; i++)`。我们需要在循环前后，增加全局的校验。

**修改点：**
引擎函数签名需增加 `documentSetup` 与 `headerFooterNodes` 参数（后者来自 `HybridDocxParseResult.headerFooterAst`，不经过 `styleAst`）：
```typescript
export function runPhysicalRuleEngine(
  nodes: DocxStyleAstNode[],
  program: PhysicalRuleProgram,
  baseline: FormatEngineBaseline,
  documentSetup?: DocumentSetup,
  headerFooterNodes?: DocxStyleAstNode[]
): PhysicalLayoutIssue[]
```

1. **边距校验 (`checkPageMargins`)**：
   比对 `documentSetup.margins` 和 `program.global_rules.page_setup`。
   如果差值大于容差（如 `0.15` 厘米），产生 `physical_layout_violation`（严重度 Medium），分析文本写："期望上边距约 3.5cm，实际 2.8cm"。

2. **页眉页脚校验 (`checkHeaderFooter`)**：
   从 `headerFooterNodes`（**非** `nodes`）中筛出 `context === "header"` 或 `"footer"` 的节点，若 `program.global_rules.header`/`footer` 存在，则调用现有的字体/字号比对辅助函数（`checkFontField` 等）进行校验。

3. **页码校验 (`checkPageNumber`)**：
   从 `headerFooterNodes` 中筛出 `has_page_number === true` 的节点。
   如果存在，对比其 `paragraph_jc`（对齐方式）、`font_zh`/`font_en`、`size_pt` 是否符合 `program.global_rules.page_number` 的要求。
   如果文档里压根没找到带有 `has_page_number` 的节点，但规则里要求了页码，可酌情报一条"未检测到自动生成的页码"。

## 4. 落地与测试建议
1. 找一个包含页眉页脚、页码，且边距被修改过的 DOCX 文件作为测试用例。
2. 在 `docx-style-ast.test.ts` 中补充以下单测：
   - `<w:pgMar>` 属性（去前缀后为 `@_top` 等）能被正确读取并换算为 cm。
   - 页眉 XML 中含 `fldSimple[@_instr=" PAGE "]` 的段落能被标记 `has_page_number: true`（注意使用去前缀属性名 `@_instr`，**而非** `@_w:instr`）。
   - 页眉页脚节点出现在 `headerFooterNodes` 中，**不出现**在 `nodes` 中。
3. 确保这个升级**不会**对原本正文轨的 `mammoth.js` Markdown 生成产生任何影响，严格保持 Hybrid 架构的数据隔离。
