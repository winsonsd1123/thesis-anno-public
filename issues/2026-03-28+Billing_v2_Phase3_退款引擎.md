# Billing v2.0 阶段三：局部退款核心引擎

**日期**：2026-03-28  
**状态**：已完成，tsc 零错误，Supabase 迁移已执行

---

## 背景

阶段一（数据/配置迁移）与阶段二（后端计费逻辑重构与新 RPC `start_review_and_deduct`）已通过 QA，本阶段目标为实现"局部退款核心引擎"：

- 单个 agent 失败 → 退还该模块的快照积分（局部退款，幂等）
- 所有已启用 agent 全部失败 → 全额退款并将任务重置为 `pending` 供用户重试

---

## 关键架构决策

### 与 Spec 步骤 7 草稿的差异

Spec 中 `partial_refund_review_stage` 草图使用 `auth.uid()` 做身份鉴权。**实际实现中不能这样做**，原因：

- Trigger.dev 编排器使用 `createAdminClient()`（`service_role` 凭证），无用户 JWT，`auth.uid()` 在此上下文中恒为 `NULL`。
- 与已有 `admin_patch_review_stage` 保持一致，采用 `SECURITY DEFINER` + `GRANT EXECUTE TO service_role`，内部通过 `reviews.user_id` 操作 `user_wallets`。

### 为何不复用 `rollback_review_after_dispatch_failure`

`rollback_review_after_dispatch_failure` 要求 `trigger_run_id IS NULL`（仅派发前失败可用）。编排中途所有 agent 失败时 `trigger_run_id` 已写入，因此需单独的 `admin_full_refund_processing_review` RPC。

---

## 数据库变更

**迁移脚本**：`docs/sql/20260330_billing_v3_partial_refund.sql`，通过 Supabase MCP 分三步执行：

| 迁移名 | 内容 |
|--------|------|
| `billing_v3_add_partial_refund_enum` | `ALTER TYPE transaction_type ADD VALUE 'partial_refund'`（含 `duplicate_object` 幂等守卫） |
| `billing_v3_partial_refund_stage_rpc` | 新增 `admin_partial_refund_review_stage(p_review_id, p_agent, p_reason?)` |
| `billing_v3_full_refund_processing_rpc` | 新增 `admin_full_refund_processing_review(p_review_id, p_reason?)` |

### `admin_partial_refund_review_stage` 设计要点

- **退款额由库内决定**：从 `reviews.cost_breakdown` 用 `jsonb_extract_path_text(cost_breakdown, p_agent)` 读取，禁止调用方传入金额
- **幂等**：先检查 `stages[]` 中目标 agent 是否已有 `refunded_at`，已存在则 `RETURN`
- **防超额**：`v_refund_amount + COALESCE(refunded_amount, 0) <= cost` 校验
- **状态允许**：`processing / completed / failed`（三态，兼容阶段四可能的顺序调整）
- `credit_transactions.type = 'partial_refund'`，`metadata` 含 `review_id`, `agent`, `reason`
- 同步更新 `reviews.refunded_amount`（累加）和 `reviews.stages`（写入 `refunded_amount` + `refunded_at`）

### `admin_full_refund_processing_review` 设计要点

- 仅允许 `status = 'processing'`（编排中途）
- 退款额 = 原始 `reviews.cost`，transaction 类型使用现有 `refund`（与 dispatch 失败回滚一致）
- 重置 `reviews`：`status = 'pending'`、`cost = 0`、`cost_breakdown = NULL`、`refunded_amount = 0`、`stages = '[]'`、`trigger_run_id = NULL`（与 `rollback_review_after_dispatch_failure` 对称）

---

## 应用层变更

### `lib/dal/review.admin.dal.ts`

新增两个方法封装 RPC 调用：

```typescript
// 局部退款（幂等，失败时 throw，编排层按需 catch）
partialRefundReviewStage(reviewId, agent, reason?)

// 全额退款并重置任务
fullRefundProcessingReview(reviewId, reason?)
```

DAL 层在 `console.error` 后 `throw`，编排层 `catch` 并决定是否继续（局部退款失败不阻断 `completeReview`）。

### `trigger/review-orchestrator.ts`

在 `finalResult` 构建后、`completeReview` 之前插入退款分支：

```
已启用 agents 全部 ok === false
  → fullRefundProcessingReview → return（不调用 completeReview）

存在部分失败
  → 逐 agent partialRefundReviewStage（失败不阻断）
  → completeReview

最外层 catch 不变
  → suspendToManualReview（整体崩溃）
```

`skippedAgent` 返回 `ok: true`，不计入失败判断。

---

## 文件变更清单

| 文件 | 变更类型 |
|------|----------|
| `docs/sql/20260330_billing_v3_partial_refund.sql` | 新增（完整迁移脚本） |
| `lib/dal/review.admin.dal.ts` | 新增 `partialRefundReviewStage` + `fullRefundProcessingReview` |
| `trigger/review-orchestrator.ts` | 在 finalResult 后插入退款分支逻辑 |
| `docs/Tech_Spec_Billing_v2.0_Modular_Pricing.md` | 注意事项第 5 条：补充阶段三 RPC 与 Spec 草稿差异说明 |

---

## 验收

- `pnpm exec tsc --noEmit`：零错误 ✅
- Supabase 三条迁移全部 `success: true` ✅
- 退款逻辑单元场景（人工验收）：
  - 仅 logic 启用且失败 → `refunded_amount` = logic 快照分，review 状态 `completed`
  - 四模块全失败 → 余额恢复，review 状态 `pending`，无 `completed` 记录
  - 重复触发同模块退款 → 幂等，不双退
