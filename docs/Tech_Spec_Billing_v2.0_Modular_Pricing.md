# AI 审阅引擎计费与退款机制升级方案 (v2.0)
## 模块化动态计费与局部精准退款 (Modular Pricing & Partial Refund)

| 版本 | 日期 | 状态 |
| :--- | :--- | :--- |
| v2.0 | 2026-03-28 | Draft |

---

## 1. 业务背景与痛点

当前 MVP 阶段的计费系统（v1.0）采用“按字数阶梯收一口价（1/2/3点）”的模式。经过实际 API 开销测算，暴露了严重的商业和体验缺陷：
1. **API 成本倒挂**：格式审查与逻辑审查深度依赖大模型长上下文，单篇最高 API 成本可达 10 元人民币以上。现有 ¥9.9/篇 的统一定价会导致“跑一单亏一单”。
2. **算力浪费与退款死局**：当前系统为“全有或全无”。如果某个轻量级模块（如 AI 痕迹）失败，系统要么将整个报告标记完成且不退款（引发客诉），要么挂起任务并全额退款（导致前期昂贵的逻辑审查算力打水漂）。
3. **不支持小数退款**：数据库余额字段 `credits_balance` 为 `int` 类型，无法支持退还 `0.5` 点。

## 2. 升级核心策略：乐高式计费与百倍点数

本方案将实施 **“1元 ≈ 10分” 的积分体系重构**，以及 **“所选即所得”的模块化定价模型**。

*   **百倍点数膨胀**：基础套餐从 9.9元/1点，升级为 19.9元/200分 或 29.9元/300分。彻底消除小数问题，使得后续局部退款全部为整数操作。
*   **按件计费 (À la carte)**：废弃总包价。配置表中将明确各字数阶梯下 `logic`, `format`, `aitrace`, `reference` 四个维度的独立价格。
*   **账单快照与精准退款**：开始审阅时，将当时的“模块单价快照”存入订单。若 Trigger 中某个引擎执行失败，直接按照快照金额原路退回相应积分，保护其余成功的模块收益。

---

## 3. 实施步骤与计划 (Execution Plan)

### 阶段一：底层数据与配置的“百倍膨胀” (Data & Config Migration)

**1. 升级计费配置文件 (Config JSON)**
*   **文件**: `config/billing.config.json`
*   **动作**: 
    *   将 `word_consumption_rules` 重命名为 `module_consumption_rules`。
    *   将原有的单一 `cost` 替换为 `costs` 对象。
    *   套餐价格与点数全面上调。
*   **结构示例**:
    ```json
    {
      "version": "3.0.0",
      "currency": "CNY",
      "packages": [
        { "id": "pkg_single", "name": "Single Pass", "credits": 300, "price": 2990, "original_price": 3990 },
        { "id": "pkg_standard", "name": "Standard Bundle", "credits": 2200, "price": 19900, "original_price": 29900 }
      ],
      "module_consumption_rules": [
        {
          "max_words": 30000,
          "costs": { "logic": 120, "format": 120, "aitrace": 30, "reference": 30 }
        },
        {
          "max_words": 50000,
          "costs": { "logic": 240, "format": 240, "aitrace": 60, "reference": 60 }
        }
      ],
      "max_allowed_words": 120000
    }
    ```

**2. 更新 Zod Schema 与类型定义**
*   **文件**: `lib/schemas/config.schemas.ts`
*   **动作**: 废弃 `wordConsumptionRuleSchema`，新增 `moduleConsumptionRuleSchema`，并更新 `billingSchema`。

**3. 数据库字段扩展 (Migration SQL)**
*   **文件**: `docs/sql/20260328_billing_v2_migration.sql` (需新建)
*   **动作**：向 `reviews` 表新增以下两列：

    | 列名 | 类型 | 说明 |
    | :--- | :--- | :--- |
    | `cost_breakdown` | `JSONB` | 开始审阅时写入的各模块单价快照，格式见下 |
    | `refunded_amount` | `INTEGER DEFAULT 0` | 已退款积分总额，**不修改 `cost` 列**（保持财务不可变性） |

*   **`cost_breakdown` 快照格式**：
    ```json
    {
      "logic": 120,
      "format": 120,
      "aitrace": 30,
      "reference": 30,
      "total": 300
    }
    ```
    仅包含本次**已选中**的模块；未选中模块不写入。

*   **`reviews.stages` entry 结构扩展**：在原有 `{ agent, status }` 基础上，新增两个可选字段，用于幂等退款守卫：
    ```json
    {
      "agent": "format",
      "status": "failed",
      "refunded_amount": 120,
      "refunded_at": "2026-03-28T10:00:00Z"
    }
    ```
    `refunded_at` 存在即表示该模块退款已完成；RPC 层以此字段作为幂等检查依据。

*   **历史数据处理**：系统当前尚未正式上线，测试数据可直接清空。SQL 脚本中仅执行 `TRUNCATE credit_transactions; UPDATE user_wallets SET credits_balance = 0;` 重置余额，无需 `* 100` 迁移。

### 阶段二：业务逻辑与 API 重构 (Backend Logic)

**4. 改造费用估算服务**
*   **文件**: `lib/config/billing.ts`
*   **动作**: 
    *   删除 `estimateCostByWords`。
    *   新增 `calculateReviewCost(wordCount: number, planOptions: ReviewPlanOptions)`，返回 `{ totalCost, breakdown }`。

**5. 升级 Estimate API**
*   **文件**: `app/api/billing/estimate-cost/route.ts` (若有，或相应的 Action)
*   **动作**: 入参接收 `planOptions`，调用新的计算逻辑，向前端返回总价和明细。

**6. 重构「开始审阅」扣费 RPC**
*   **文件**: 在 `docs/sql/20260328_billing_v2_migration.sql` 中提供新版 `CREATE OR REPLACE FUNCTION`。
*   **新函数签名**:
    ```sql
    start_review_and_deduct(
      p_review_id       bigint,
      p_total_cost      integer,   -- Server Action 计算出的总积分，RPC 内不再重算
      p_cost_breakdown  jsonb,     -- 各模块单价快照，写入 reviews.cost_breakdown
      p_plan_options    jsonb      -- { logic: true, format: false, ... }，用于生成 stages
    ) RETURNS void
    ```
*   **关键逻辑变更**（相较于 v1 版本）：

    | 变更点 | v1 行为 | v2 行为 |
    | :--- | :--- | :--- |
    | 积分计算 | RPC 内依赖前端传 `p_required_credits` | Server Action 计算，RPC 仅扣减 `p_total_cost`（防篡改） |
    | `reviews.cost` | 写入 `p_required_credits` | 写入 `p_total_cost` |
    | `reviews.cost_breakdown` | 不存在 | 写入 `p_cost_breakdown` 快照 |
    | `reviews.stages` 生成 | 硬编码 4 个 `pending` | 依据 `p_plan_options` 动态生成：选中 → `pending`，未选中 → `skipped` |

*   **stages 动态生成逻辑**（继承 `20260327_plan_options_format_default_off.sql`）：
    ```sql
    -- 伪代码：对每个 agent in ('logic','format','aitrace','reference')
    CASE WHEN (p_plan_options ->> agent)::boolean IS TRUE
      THEN jsonb_build_object('agent', agent, 'status', 'pending')
      ELSE jsonb_build_object('agent', agent, 'status', 'skipped')
    END
    ```
*   **Server Action 职责**（调用 RPC 之前完成）：
    1. 读取远端 `billing.config.json`，按 `wordCount` + `planOptions` 计算 `totalCost` 和 `breakdown`
    2. 将结果传入 RPC（**前端禁止传价格参数**）

### 阶段三：局部退款核心引擎 (The Refund Engine)

**7. 新增局部退款 RPC（含完整幂等设计）**
*   **文件**: 添加到上述的 migration SQL 文件中。
*   **函数签名**:
    ```sql
    partial_refund_review_stage(
      p_review_id    bigint,
      p_agent        text,       -- 'logic' | 'format' | 'aitrace' | 'reference'
      p_refund_amount integer,   -- 退款积分数，从 cost_breakdown 快照中读取
      p_reason       text        -- 记录到 credit_transactions.metadata
    ) RETURNS void
    ```
*   **执行逻辑（含幂等守卫）**:
    ```
    1. FOR UPDATE 锁定 reviews 行，读取 stages JSONB
    2. 找到 stages 中 agent = p_agent 的 entry
       → 若 entry.refunded_at IS NOT NULL，直接 RETURN（幂等：已退款，跳过）
    3. 校验 reviews.status IN ('processing', 'completed', 'failed')
       → 不在范围内则 RAISE EXCEPTION 'INVALID_STATUS'
    4. FOR UPDATE 锁定 user_wallets，执行：
         credits_balance += p_refund_amount
    5. INSERT INTO credit_transactions：
         type = 'partial_refund'，amount = +p_refund_amount
         metadata = { review_id, agent: p_agent, reason: p_reason }
    6. UPDATE reviews：
         refunded_amount += p_refund_amount
         stages[target].refunded_amount = p_refund_amount
         stages[target].refunded_at = now()
    ```
*   **关键约束**：
    - `reviews.cost` **不修改**，始终反映原始扣费额；真实净耗 = `cost - refunded_amount`
    - 幂等键为 `stages[].refunded_at`，Trigger 重试时无需额外去重，DB 层天然保证
    - `p_refund_amount` 必须由 Server Action 从 `reviews.cost_breakdown` 快照中读取，**禁止由前端传入**

**8. Trigger Orchestrator 容错与退款闭环**
*   **文件**: `trigger/review-orchestrator.ts`
*   **动作**:
    *   在 `Promise.allSettled` 结果处理中，不再对单一错误执行 `suspendToManualReview`。
    *   读取 `review.cost_breakdown` 快照。
    *   若某引擎失败（例如 `formatRes.ok === false`），从快照提取其单价。
    *   调用新 RPC `partial_refund_review_stage` 自动退还对应积分，并在日志中记录。
    *   如果所有引擎**全部失败**，则降级走原有 `rollback_review_after_dispatch_failure` 进行全额退款。

### 阶段四：前端交互重构 (Frontend UI)

**9. 审阅配置面板实时计价**
*   **文件**: `app/[locale]/dashboard/_components/ReviewChatBoard.tsx`
*   **动作**: 
    *   用户勾选 `planOptions` (格式、逻辑等) 时，实时触发计费估算。
    *   在每个 Checkbox 旁展示该模块的具体消耗（如 `+120 积分`）。
    *   底部汇总展示 `本次共需消耗：XXX 积分`。
    *   若积分不足，禁用“开始审阅”按钮并提示去充值。

**10. 失败模块的 UI 反馈**
*   **文件**: `app/[locale]/dashboard/_components/ReportViewer.tsx` (或相关展示组件)
*   **动作**: 当某模块的 result 为 `{ error: "..." }` 时，在对应 Tab 内展示明显的退款提示：“该模块因系统异常生成失败，已为您自动退还 XXX 积分。”

### 阶段五：工单系统 MVP 闭环 (Support Tickets MVP)

针对严重故障（主流程全面崩溃，无法通过局部退款解决），系统采用 **“重后台兜底，轻前台交互”** 的策略：

**11. 系统自动建单 (暗线闭环)**
*   **文件**: `lib/dal/review.admin.dal.ts` (现有 `suspendToManualReview` 逻辑)
*   **动作**: 保持现有逻辑不变。当整个 Trigger 任务崩溃时，自动将状态更新为 `needs_manual_review`，并在 `support_tickets` 表中插入一条高优先级工单。**暂不开发用户侧的主动提单 UI。**

**12. 用户侧极简安抚提示**
*   **文件**: `app/[locale]/dashboard/_components/ReviewWorkbench.tsx`
*   **动作**: 当任务状态为 `needs_manual_review` 时，展示统一安抚文案：“⚠️ **系统异常**：您的审阅任务遇到了未知错误。系统已自动为您生成加急工单。我们的专家正在人工核实并将在 24 小时内为您处理（重试或退款）。如有疑问请联系客服微信：xxx。”

**13. 管理员侧极简处理面板**
*   **动作**: 在 Admin 模块中提供一个极简的工单列表视图。
    *   **查询**: 仅拉取 `status = 'open'` 的工单。
    *   **操作**: 提供“一键全额退款”按钮（调用相关退款 RPC 并将工单标为 `resolved`）和“标记已解决”按钮。

---

## 4. 注意事项与验收标准
1. **防并发篡改**：前端不可传总价给后端。必须由 Server Action 拿到 `wordCount` 和 `planOptions` 后，重新读取远端配置算出 `totalCost`，再传给 RPC 扣费。
2. **历史兼容性**：系统尚未正式上线，SQL 脚本中直接重置测试数据（`TRUNCATE credit_transactions`），无需 `* 100` 迁移。正式上线后若需升级老数据，需单独评估并加幂等守卫。
3. **退款幂等性**：幂等守卫通过 `reviews.stages[].refunded_at` 实现。`partial_refund_review_stage` RPC 执行前先检查目标 agent 的 `refunded_at` 是否已存在——若已存在则直接 `RETURN`，无任何写操作。由于幂等由 DB 层保证，**Trigger 调用方无需额外去重**，重试对结果无影响。

4. **`reviews.cost` 不可变原则**：`cost` 列写入后不再修改，始终代表原始扣费额。退款通过 `refunded_amount` 列累计，真实净耗 = `cost - refunded_amount`，可在查询层按需计算。

5. **阶段三实现备注（与 Spec 步骤 7 草稿的差异）**：Spec 步骤 7 的 RPC 草图使用 `auth.uid()` 进行用户身份识别；实际阶段三 RPC（`admin_partial_refund_review_stage`、`admin_full_refund_processing_review`）均以 `SECURITY DEFINER` 方式运行，并通过 `GRANT EXECUTE TO service_role` 限制为 Trigger.dev 后台调用（使用 `createAdminClient()`，无用户 JWT）。RPC 内部通过 `reviews.user_id` 查找并操作 `user_wallets`，禁止调用方传入退款金额（由库内快照 `reviews.cost_breakdown` 决定）。`admin_full_refund_processing_review` 仅限 `status = 'processing'` 时调用，重置 review 到 `pending` 供用户重试，使用 `refund` 类型 transaction（与派发失败回滚一致）。

6. **阶段五实现备注（Admin 退款 RPC）**：阶段五新增 `admin_refund_needs_manual_review_and_resolve_ticket(p_ticket_id, p_admin_id, p_reason)` RPC，同样为 `SECURITY DEFINER` + `GRANT EXECUTE TO service_role`，由 Admin Server Action（`createAdminClient()`）调用。该 RPC 专门处理 `status = 'needs_manual_review'` 的审阅，在单事务内原子完成：全额退还积分、重置 review 到 `pending`、将关联 `support_tickets` 标记为 `resolved`。「仅结案」操作（不退款）直接由 Server Action 通过 `createAdminClient()` 更新 `support_tickets` 表即可，无需 RPC。客服微信号从环境变量 `NEXT_PUBLIC_SUPPORT_WECHAT` 读取，缺省显示占位说明文案。
