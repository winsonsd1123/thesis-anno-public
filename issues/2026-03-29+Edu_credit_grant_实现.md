# 教育网积分申领 — 实现记录

**日期**: 2026-03-29

## 部署前必做

在 Supabase SQL Editor 执行：

1. [`docs/sql/20260330_edu_credit_grant.sql`](../docs/sql/20260330_edu_credit_grant.sql)（表与初始 RPC）
2. [`docs/sql/20260331_edu_credit_grant_max_claims.sql`](../docs/sql/20260331_edu_credit_grant_max_claims.sql)（`max_claims`、双参 `open`、`claim` 名额与满额关窗）
3. [`docs/sql/20260332_edu_grant_claims_email_view.sql`](../docs/sql/20260332_edu_grant_claims_email_view.sql)（管理端历史：`edu_credit_grant_claims_with_email` 视图，仅 `service_role`）

（线上已通过 MCP `apply_migration` 的以控制台为准。）

## 代码入口

- DAL: `lib/dal/edu-credit-grant.dal.ts`
- Service: `lib/services/edu-credit-grant.service.ts`（`EDU_GRANT_CREDIT_AMOUNT = 300`）
- Actions: `lib/actions/edu-credit-grant.actions.ts`、`lib/actions/admin-edu-credit-grant.actions.ts`
- 管理页: `app/[locale]/admin/config/edu-grant/`
- 用户计费页: `EduGrantBillingSection` + `dashboard/billing/page.tsx`
- 域名校验单测: `lib/services/edu-credit-grant.service.test.ts`

## 行为摘要

- 开放窗口：`open` 会先关闭当前未关窗口再插入新行；可传 `p_max_claims`（默认 10，应用层 clamp 1～10000）。
- 申领：需已验证邮箱、域名匹配 `\.(edu|ac)\.cn$`、余额为 0、当前有开放窗口、该窗口内未领过、且未达本轮 `max_claims`；成功则 `bonus` 流水 +300；若已达上限则关窗并返回 `EDU_GRANT_QUOTA_FULL`。
