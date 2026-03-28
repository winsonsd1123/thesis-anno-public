# Billing v2.0 Phase 5 — 工单系统 MVP 闭环

**日期**：2026-03-28  
**模块**：Billing v2.0 阶段五  
**负责人**：AI 开发组

---

## 目标

完成 Spec 阶段五：为 `needs_manual_review` 状态（系统自动挂起的审阅）提供完整的端到端闭环——用户侧看到安抚文案，Admin 侧可在工单列表执行「退款并结案」或「仅结案」操作。

---

## 核心变更

### 1. 数据库 RPC（`docs/sql/20260331_billing_v5_admin_ticket_refund.sql`）

新增原子 RPC：

```sql
admin_refund_needs_manual_review_and_resolve_ticket(
  p_ticket_id uuid,
  p_admin_id  uuid,
  p_reason    text DEFAULT NULL
)
```

**事务内按序执行**：

1. `SELECT ... FROM support_tickets WHERE id = p_ticket_id FOR UPDATE`：锁定工单，校验 `status = 'open'`（非 open 直接 `RAISE EXCEPTION 'TICKET_NOT_OPEN'`）。
2. 通过 `review_id` 锁定 reviews 行，校验 `status = 'needs_manual_review'`。
3. 若 `cost >= 1`：更新 `user_wallets` 余额，插入 `credit_transactions`（type = `refund`，metadata 含 `reason: 'manual_suspend_refund'`）。
4. 重置 `reviews`：`status = 'pending'`，`cost = 0`，`cost_breakdown = NULL`，`refunded_amount = 0`，`stages = '[]'`，`trigger_run_id = NULL`，`error_message = NULL`（与 `admin_full_refund_processing_review` 对称）。
5. 更新 `support_tickets.status = 'resolved'`，写入 `resolution`、`admin_id`、`updated_at`。

安全设计：`SECURITY DEFINER` + `REVOKE FROM PUBLIC` + `GRANT EXECUTE TO service_role`。

### 2. DAL（`lib/dal/support-ticket.admin.dal.ts`）

- `listOpenTickets()`：`createAdminClient` 绕过 RLS，查询所有 `status = 'open'` 工单，含 `reviews(file_name, status)` 嵌套。
- `resolveTicketOnly(ticketId, adminId, resolution)`：仅更新工单为 `resolved`，不触碰 reviews。

### 3. Server Actions（`lib/actions/support-ticket.admin.actions.ts`）

所有入口先 `getAdminUserOrNull()` 鉴权：

- `listOpenTickets()`：透传 DAL。
- `refundSuspendedReviewAndResolveTicket(ticketId)`：调用 `admin_refund_needs_manual_review_and_resolve_ticket` RPC（via `createAdminClient`）。
- `resolveSupportTicketOnly(ticketId, resolution?)`：调用 DAL `resolveTicketOnly`。

### 4. Admin UI（`app/[locale]/admin/tickets/`）

- `page.tsx`：Server Component，`requireAdmin()` → `listOpenTickets()` → 渲染 `TicketsTableClient`。
- `TicketsTableClient.tsx`：Client Component，每行两个按钮：
  - **退款并结案**（仅在 `review_id` 非空时显示）：`confirm` → `refundSuspendedReviewAndResolveTicket` → `router.refresh()`。
  - **仅结案**：`confirm` → `resolveSupportTicketOnly` → `router.refresh()`。
  - 使用 `useTransition` 管理 pending 状态，按钮 disabled + 文案变「处理中…」。
- `admin/layout.tsx`：导航栏新增「工单」链接指向 `/admin/tickets`。

### 5. 用户侧安抚（`app/[locale]/dashboard/_components/ReviewWorkbench.tsx`）

拆分原有 `showErrorBanner` 逻辑：

- `needs_manual_review` → 橙色安抚 Banner：显示 `manualReviewReassuranceTitle` + `manualReviewReassuranceBody`（含微信客服），原始 `error_message` 可折叠展示 + 复制按钮。
- `failed` → 保持原有红色错误 Banner。

新增 `supportWechat?: string` prop，由 `app/[locale]/dashboard/(withNav)/page.tsx` 从 `process.env.NEXT_PUBLIC_SUPPORT_WECHAT` 读取后传入。

### 6. 国际化

新增 i18n keys：

**`dashboard.review`**（zh/en）：
- `manualReviewReassuranceTitle`
- `manualReviewReassuranceBody`（含 `{wechat}` 插值）
- `manualReviewWechatFallback`

**`admin.tickets`**（zh/en）：
- `title`, `subtitle`, `navLabel`, `empty`
- `colSubject`, `colPriority`, `colCreatedAt`, `colReview`, `colStatus`
- `btnRefundResolve`, `btnResolveOnly`
- `confirmRefundResolve`, `confirmResolveOnly`
- `actionSuccess`, `actionError`, `processing`

---

## 环境变量

| 变量 | 说明 | 是否必须 |
|---|---|---|
| `NEXT_PUBLIC_SUPPORT_WECHAT` | 客服微信号，显示在安抚 Banner 中 | 否（缺省显示占位文案） |

---

## 验收标准

- [x] `pnpm exec tsc --noEmit` 零错误。
- [ ] 构造 `needs_manual_review` + open ticket → Admin 工单列表可见。
- [ ] 「退款并结案」后：用户余额增加、审阅重置为 `pending`、工单 `resolved`。
- [ ] 「仅结案」：仅工单 `resolved`，reviews 不变。
- [ ] 非 open 工单重复操作报错 `TICKET_NOT_OPEN`。
- [ ] 用户端 `needs_manual_review` 显示橙色安抚 Banner，`failed` 仍显示红色错误 Banner。

---

## 文件清单

| 文件 | 操作 |
|---|---|
| `docs/sql/20260331_billing_v5_admin_ticket_refund.sql` | 新增 |
| `lib/dal/support-ticket.admin.dal.ts` | 新增 |
| `lib/actions/support-ticket.admin.actions.ts` | 新增 |
| `app/[locale]/admin/tickets/page.tsx` | 新增 |
| `app/[locale]/admin/tickets/TicketsTableClient.tsx` | 新增 |
| `app/[locale]/admin/layout.tsx` | 修改（导航链接） |
| `app/[locale]/dashboard/_components/ReviewWorkbench.tsx` | 修改（安抚 Banner + supportWechat prop） |
| `app/[locale]/dashboard/(withNav)/page.tsx` | 修改（传 supportWechat） |
| `messages/zh.json` | 修改（新增 i18n keys） |
| `messages/en.json` | 修改（新增 i18n keys） |
| `docs/Tech_Spec_Billing_v2.0_Modular_Pricing.md` | 修改（阶段五备注） |
