# Format Service 双轨制实施记录

## 摘要

- DB：`reviews.format_guidelines`、`reviews.format_physical_extract`（迁移已应用 Supabase + 参考 SQL `docs/sql/20260326_reviews_format_guidelines.sql`）。
- 配置：`config/format-guidelines.default.zh.md`（预设 NL）、`config/format-rule-packs/engine-baseline.json`（引擎基线）。
- 服务：`analyzeFormat(markdown, styleAst, "text", ctx)` — 并行语义 Pro + 抽取 Flash，`compilePhysicalRules` + `runPhysicalRuleEngine`。
- Prompts：`format_review_system`、`format_physical_spec_extract`（`config/prompts.default.json`）。
- 前端：勾选格式维时必填多行 NL；导入通用模板；启动前 `updateReviewFormatGuidelines` + `startReviewEngine` 校验 `FORMAT_GUIDELINES_REQUIRED`。

## 验证

- `pnpm test`、`pnpm build` 已通过。
