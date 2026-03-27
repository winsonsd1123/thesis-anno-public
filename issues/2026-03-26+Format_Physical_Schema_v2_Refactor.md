# 格式物理轨 Schema v2 全链路重构（2026-03-26）

**依据**：[Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md](../docs/Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md)

## 变更摘要

将物理规则全链路从单一 `font` 字段迁移到 `font_zh`/`font_en` 双字段，扩展 `ParagraphContext` 支持 `references`/`footnotes` 新上下文。

## 涉及文件

| 区域 | 路径 | 变更 |
|------|------|------|
| 类型 | `lib/types/docx-hybrid.ts` | `RunSpan`/`DocxStyleAstNode`: `font` → `font_zh`+`font_en`；`ParagraphContext` 新增 `references`\|`footnotes` |
| OOXML | `lib/review/docx-style-ast.ts` | `rprToRunSpan`/`paragraphToNode` 输出拆分；新增 `inferFootnotesContext`、`REFERENCES_HEADING_RE` 后扫描标记 |
| 编译 | `lib/review/compile-physical-rules.ts` | `fontAllowlist` → `fontAllowlistZh`/`fontAllowlistEn`；`ParagraphMatch` 新增 `references`/`footnotes`；新增 `references-default`/`footnotes-default` 规则编译 |
| 引擎 | `lib/services/review/format-rules.engine.ts` | 抽取 `checkFontField` 统一双路检查；`inferHeadingLevelByFormat` 适配 `font_zh`；`CONTEXT_RULE_KINDS` 统一 caption/references/footnotes 分流 |
| 测试 | `lib/review/compile-physical-rules.test.ts` | schema_version→2，font→font_zh，新增 font_zh/font_en 拆分与 references/footnotes 编译测试 |
| 测试 | `lib/services/review/format-rules.engine.test.ts` | 全量迁移 + 新增 font_en 检测、references/footnotes 上下文匹配测试（共 20 条） |
| Prompt | `config/prompts.default.json` | `format_physical_spec_extract` 升级 v2：字体拆分说明、references/footnotes/page_setup 字段、禁止臆造 |
| 脚本 | `scripts/smoke-hybrid-docx.ts` | 输出格式适配 `font_zh`/`font_en` |

## 验证

- `pnpm exec tsx --test` — 20/20 pass
- `pnpm build` — 编译通过，无 TypeScript 错误
