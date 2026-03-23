# AI 审阅 Trigger 编排（Spec 2/3）与后续修复 — 工作记录

**日期**: 2026-03-22  
**依据文档**: `docs/Tech_Spec_AI_Review_2_Trigger.md`、落地计划 `ai_review_trigger_编排_62eaf030`（未改计划文件本身）  
**Supabase 项目**: `zelzsbzvweixrjchayhl`

---

## 一、Trigger 编排与数据层（首轮落地）

### 1. 数据库（MCP 迁移 + `docs/sql` 备份）

| 对象 | 说明 |
|------|------|
| `start_review_and_deduct(p_review_id, p_required_credits)` | `SECURITY DEFINER`，事务内：校验 `pending` 与归属、扣 `user_wallets`、写 `credit_transactions`（`consumption` 负额）、将 `reviews` 置 `processing` 并初始化三 agent `stages`。`GRANT authenticated`。 |
| `admin_patch_review_stage(p_review_id, p_agent, p_status, p_log)` | 单条 SQL 原子更新 `stages` JSONB 中某一 agent，避免并行读改写覆盖；仅 `GRANT service_role`（后台 DAL 使用）。 |
| `rollback_review_after_dispatch_failure(p_review_id)` | Trigger 派发失败或未配置时的补偿：`processing` 且 `trigger_run_id` 为空时退款、`reviews` 回 `pending`、清空 `cost/stages`；`credit_transactions` 记 `refund`。`GRANT authenticated`。 |

备份文件：

- `docs/sql/20260322_start_review_and_deduct.sql`
- `docs/sql/20260322_admin_patch_review_stage.sql`
- `docs/sql/20260322_rollback_review_after_dispatch_failure.sql`

### 2. Server Action：`lib/actions/trigger.action.ts`

- 顺序：**`start_review_and_deduct` → `tasks.trigger("orchestrate-review", { reviewId })` → `reviewDAL.updateTriggerRunId`**。
- **`TRIGGER_SECRET_KEY` 缺失**、`tasks.trigger` 抛错、或 **run id 为空**：调用 **`rollback_review_after_dispatch_failure`**，返回 `TRIGGER_NOT_CONFIGURED` / `TRIGGER_DISPATCH_FAILED` 等（不再在「无 Run」时仍 `ok: true`）。
- 扣费失败仍通过 RPC 错误码映射为 `INSUFFICIENT_CREDITS` 等。

### 3. DAL / Storage

- `lib/dal/review.dal.ts`：`updateTriggerRunId`（仅 `processing` 行回写 `trigger_run_id`）。
- `lib/dal/review.admin.dal.ts`：`getReviewById`、`updateStageStatus`（改调 **`admin_patch_review_stage` RPC**）、`completeReview`、`suspendToManualReview`（`support_tickets` 使用线上列：`category` / `subject` / `description` / `priority`）；保留原带 `userId` 方法以兼容 `review.service`。
- `lib/dal/storage.dal.ts`：`downloadReviewPdf` → `Buffer`（Service Role）。

### 4. Trigger 工程

- `trigger.config.ts`：`defineConfig`，`TRIGGER_PROJECT_REF`、`dirs: ["./trigger"]`、`maxDuration: 3600`。
- `trigger/review-orchestrator.ts`：任务 `orchestrate-review`；`storageDAL` + 懒加载 `pdf-parse`；三 agent 并发 + `executeWithFallback`。
- `trigger/utils/pdf-extractor.ts`：多模态失败降级文本，共享 `getParsedText` 缓存。

### 5. Engine 桩（路径 A）

- `lib/services/review/format.service.ts`、`logic.service.ts`、`reference.service.ts`：占位 JSON（`stub: true`），待 Spec 3 替换真 LLM。

### 6. 依赖

- `pdf-parse` + `@types/pdf-parse`。

### 7. 国际化

- 审阅错误：`WALLET_NOT_FOUND`、`INVALID_CREDITS`；补偿后：`TRIGGER_NOT_CONFIGURED`、`TRIGGER_DISPATCH_FAILED`、`ROLLBACK_FAILED`、`ROLLBACK_INVALID_COST`、`RUN_ALREADY_ATTACHED`（`ReviewChatBoard` `te()` 已映射）。

---

## 二、并发 stages 与历史侧栏（问题修复）

### 1. 进度条与库不一致

- **原因**：并行 `updateStageStatus` 读改写 `stages` 互相覆盖；`result` 与 `status` 已写完但 `stages` 仍部分 `running`。
- **处理**：`admin_patch_review_stage` 原子补丁 + `review.admin.dal.updateStageStatus` 改为 RPC。

### 2. 报告已出、历史栏仍「进行中」，刷新后才对

- **原因**：侧栏数据来自 RSC `initialReviews`，Realtime 只更新 Zustand `activeReview`。
- **处理**：`lib/hooks/useReviewRealtime.ts` 在 payload 为终态（`completed` / `failed` / `needs_manual_review` / `refunded` / `cancelled`）时 **`router.refresh()`**。

---

## 三、一致性策略（用户确认：Trigger 失败则 pending + 退款）

- 见第一节 **`rollback_review_after_dispatch_failure`** 与 **`startReviewEngine`** 分支说明。
- **未解决边界**：`tasks.trigger` 已成功但 **`updateTriggerRunId` 失败** 时仍返回 `START_FAILED` 且不自动 rollback（云端可能已有 Run），需后续策略或工单。

---

## 四、测试与环境提示

- **发起 Trigger**：服务端 Server Action（非浏览器直连）；需 `TRIGGER_SECRET_KEY`、`TRIGGER_PROJECT_REF`；Worker 环境需 `SUPABASE_SERVICE_ROLE_KEY` 等。
- **Trigger 控制台无 Run**：核对项目 ref、Development 环境、以及 DB `trigger_run_id`。
- 本地：`pnpm dev` + `npx trigger.dev@latest dev`（按需）。

---

## 五、相关文件索引（便于 Code Review）

| 区域 | 路径 |
|------|------|
| Action | `lib/actions/trigger.action.ts` |
| Realtime | `lib/hooks/useReviewRealtime.ts` |
| Admin DAL | `lib/dal/review.admin.dal.ts` |
| User DAL | `lib/dal/review.dal.ts` |
| Storage | `lib/dal/storage.dal.ts` |
| 编排 | `trigger/review-orchestrator.ts`、`trigger/utils/pdf-extractor.ts`、`trigger.config.ts` |
| 桩服务 | `lib/services/review/*.service.ts` |
| 文案 | `messages/zh.json`、`messages/en.json`（`dashboard.review.errors`） |
