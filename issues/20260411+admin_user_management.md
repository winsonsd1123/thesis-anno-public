# 后台用户管理（CRUD + 禁用 + 最后登录）

**日期**: 2026-04-11

## 摘要

- Supabase 迁移：`profiles.is_disabled`（默认 `false`）；仓库备份 [`docs/sql/20260411_profiles_is_disabled.sql`](docs/sql/20260411_profiles_is_disabled.sql)。
- 中间件：受保护路由下若 `is_disabled` 则 `signOut` 并跳转 `/{locale}/account-disabled`。
- 数据层：`lib/dal/user.admin.dal.ts`（Auth Admin + `createAdminClient` 写 `profiles`）。
- 服务层：`lib/services/user.admin.service.ts`（最后管理员、禁止自删/自禁用/自降级等）。
- Actions：`lib/actions/user.admin.actions.ts`。
- UI：`/admin/users` 列表（筛选、分页、新建）、`/admin/users/[id]` 详情编辑；导航入口在 admin layout。

## 验证建议

- 管理员登录 → 用户管理 → 列表含「最后登录」列。
- 禁用某用户后，该用户访问 `/dashboard` 应被重定向至账号停用页且会话清除。
- 尝试删除或禁用唯一活跃管理员应提示错误。
