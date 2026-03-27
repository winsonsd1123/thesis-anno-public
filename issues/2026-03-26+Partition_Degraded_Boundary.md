# 组合降级分界与多区段解析重构 (2026-03-26)

**依据**：[Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md](../docs/Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md) 及架构优化讨论

## 变更摘要
引入全新的全局结构切分（DocumentPartition）能力，在 AST 解析阶段通过“组合降级策略”寻找正文起点，彻底消灭封面与目录被错误当做正文查排版的误报问题。

## 核心实现设计
1. **多维特征提取 (`lib/review/docx-style-ast.ts`)**
   - **大纲级别**：提取 `<w:outlineLvl>`（0=1级标题）。
   - **页码格式突变**：提取 `<w:sectPr><w:pgNumType w:fmt="decimal" w:start="1"/>`（阿拉伯数字重置 1）。
   - **TOC 域代码**：提取 `<w:instrText>TOC...` 识别自动目录区域。
2. **后扫描状态机 (`partitionDocumentAst`)**
   - 将文档线性切分为 5 大区段：`front_cover` -> `abstract` -> `toc` -> `main_body` -> `references`。
   - `main_body` 起点定位优先级：(1) 页码突变的分界线 (2) 目录结束后的第一个 1 级标题 (3) 目录结束后正则匹配的特征标题。
3. **引擎放行 (`lib/services/review/format-rules.engine.ts`)**
   - 规则引擎在主循环最顶层硬拦截 `partition === "front_cover" || partition === "toc"` 的段落，**不套用任何物理规则**。
   - 改进 `nearestHeadingPath`：优先使用原生的 `outlineLevel` 取代启发式的正则，精准度大幅提升。

## 涉及文件
- `lib/types/docx-hybrid.ts`：扩展 `DocxStyleAstNode` 字段，新增 `DocumentPartition` 类型。
- `lib/review/docx-style-ast.ts`：实现特征提取函数和状态机逻辑。
- `lib/services/review/format-rules.engine.ts`：增加区段跳过逻辑，优化标题层级推断。
- `lib/services/review/format-rules.engine.test.ts`：补充 `front_cover` / `toc` 豁免测试，补充 `abstract` 的分流测试。

## 验证
- 22 个测试用例全部通过（包含区段跳过和 fallback 测试）。
- `pnpm build` 无类型错误（已修复 `current !== "main_body"` 互斥类型推断问题）。