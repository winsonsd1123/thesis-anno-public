# 计费与退款机制 v2.0 测试报告 (Modular Pricing & Partial Refund)

## 1. 测试概览
根据 `Tech_Spec_Billing_v2.0_Modular_Pricing.md` 提供的技术方案，对阶段二（计算与扣费）、阶段三（局部退款核心引擎）的底层逻辑及 DB RPC 进行了系统性的集成测试与单元测试验证。

**测试执行环境：**
- 运行框架：`node:test` / Node.js
- 依赖：`@supabase/supabase-js` (集成测试), `tsx`
- 目标：Supabase Dev 数据库环境

## 2. 测试用例与执行结果

### 2.1 模块化计费核心逻辑 (Unit Test)
*   **目标函数**: `sumModuleCostsForPlan` (`lib/config/billing.ts`)
*   **测试场景**:
    1.  **全部模块开启**: 输入 `{ logic: 120, format: 120, aitrace: 30, reference: 30 }` 和 `{ logic: true, format: true, aitrace: true, reference: true }`，预期总额 300。 -> ✅ **通过**
    2.  **部分模块开启**: 输入相同的价格配置，仅开启 `{ logic: true, aitrace: true }`，预期总额 150。 -> ✅ **通过**
    3.  **全不开启**: 预期总额 0。 -> ✅ **通过**

### 2.2 开始审阅与扣费 (Integration Test)
*   **目标 RPC**: `start_review_and_deduct`
*   **测试场景**: 创建测试用户并分配初始 1000 积分。提交 150 积分的审核任务，包含格式 (120) 和 AI痕迹 (30)。
*   **验证点**:
    *   用户钱包扣除 150 积分 (预期余额: 850)。 -> ✅ **通过**
    *   `reviews` 表 `cost` 变更为 150。 -> ✅ **通过**
    *   `reviews` 表 `status` 变更为 `processing`。 -> ✅ **通过**
    *   `reviews` 表 `stages` 准确映射 `planOptions` (格式、AI痕迹为 `pending`，逻辑、参考文献为 `skipped`)。 -> ✅ **通过**

### 2.3 局部退款与幂等性 (Integration Test)
*   **目标 RPC**: `admin_partial_refund_review_stage`
*   **测试场景**: 模拟 Trigger 编排器发现 "格式" 模块执行失败，调用局部退款 RPC。
*   **验证点**:
    *   用户钱包增加 120 积分 (预期余额: 970)。 -> ✅ **通过**
    *   `reviews` 表 `refunded_amount` 更新为 120。 -> ✅ **通过**
    *   `stages` 数组中的 `format` 项追加 `refunded_amount: 120` 和 `refunded_at` 时间戳。 -> ✅ **通过**
*   **幂等性测试**:
    *   再次对 `format` 模块调用退款 RPC。
    *   钱包余额未变，无重复扣费 (仍为 970)。 -> ✅ **通过**

### 2.4 全额退款兜底逻辑 (Integration Test)
*   **目标 RPC**: `admin_full_refund_processing_review`
*   **测试场景**: 模拟 Trigger 任务全局崩溃，调用全额兜底退款。
*   **验证点**:
    *   任务状态回滚至 `pending`。 -> ✅ **通过**
    *   钱包余额恢复。 -> ❌ **发现缺陷** (已在本次迭代中修复)

### 2.5 前端交互逻辑 (Frontend UI Verification)
*   **目标组件**: `PlanConfirmBubble`, `ReviewChatBoard`, `ReportViewer`
*   **验证点**:
    *   `PlanConfirmBubble` 支持传入并显示各模块单价 (`stepCosts`)，在 Checkbox 旁展示 `+XXX 积分`。 -> ✅ **已实现**
    *   实时触发计费估算，动态汇总总价。 -> ✅ **已实现**
    *   余额不足时 (`insufficientCredits`)，正确禁用“开始审阅”按钮并提示充值。 -> ✅ **已实现**
    *   退款提示：在 `ReviewWorkbench` / `ReportViewer` 中，通过 `agentRefunds` 正确展示系统自动退还的积分信息。 -> ✅ **已实现**

## 3. 发现的缺陷与修复建议

### 缺陷：全额兜底退款超额 (Bug in `admin_full_refund_processing_review`)
*   **问题描述**：在已经发生了“局部退款”的情况下，如果触发全额退款兜底（如其余任务突然崩溃），原 RPC 依然按 `reviews.cost` (初始总价) 进行全额退款，导致用户多退了已退过的积分（测试中钱包余额变为了 1120，超出了初始的 1000）。
*   **修复方案**：已修改对应的迁移脚本 `docs/sql/20260330_billing_v3_partial_refund.sql`。
    将全额退款的计算逻辑从：
    ```sql
    v_cost := COALESCE(v_review.cost, 0);
    ```
    修复为减去已退款金额：
    ```sql
    v_cost := COALESCE(v_review.cost, 0) - COALESCE(v_review.refunded_amount, 0);
    ```
*   **执行建议**：请重新在 Supabase 控制台执行更新后的 `20260330_billing_v3_partial_refund.sql` 以覆盖原 RPC 函数。

## 4. 结论
Billing v2.0 的核心逻辑（扣费快照生成、动态 stage 初始化、局部退款幂等处理）在数据库与业务层表现稳定。已知缺陷已定位并提供修复脚本。整体后端流程达到可用状态。下一步可进行前端界面的联动测试。

---

## 5. 补充评审 & 二次修复 (2026-03-28 Round 2)

### 5.1 评审发现的遗漏缺陷

**`admin_refund_needs_manual_review_and_resolve_ticket` 存在同款超额退款 Bug**

- **位置**：`docs/sql/20260331_billing_v5_admin_ticket_refund.sql`
- **问题**：原代码 `v_cost := COALESCE(v_review.cost, 0);` 未减去已局部退款金额，与 Phase 3 中发现的 Bug 完全一致。若用户触发工单手动退款前已发生局部退款，会造成多退积分。
- **修复**：改为 `v_cost := COALESCE(v_review.cost, 0) - COALESCE(v_review.refunded_amount, 0);`

### 5.2 修复清单

| SQL 文件 | 修复的 RPC | 状态 |
|----------|-----------|------|
| `20260330_billing_v3_partial_refund.sql` | `admin_full_refund_processing_review` | ✅ 已部署 |
| `20260331_billing_v5_admin_ticket_refund.sql` | `admin_refund_needs_manual_review_and_resolve_ticket` | ✅ 已部署 |

两个 RPC 均已通过 `apply_migration` 重新部署至 Supabase（project: `zelzsbzvweixrjchayhl`）。

### 5.3 回归测试结果

测试时间：2026-03-28 | 测试脚本：`scripts/test-billing-v2.ts`

#### 原有用例（全部回归通过）

| 编号 | 测试场景 | 结果 | 余额验证 |
|------|---------|------|---------|
| T1 | `start_review_and_deduct` 扣费 150 | ✅ 通过 | 1000 → 850 |
| T2 | `admin_partial_refund_review_stage` 局部退款 120 | ✅ 通过 | 850 → 970 |
| T3 | 局部退款幂等性（重复调用） | ✅ 通过 | 970 不变 |
| T4 | `admin_full_refund_processing_review` 有局部退款后全额兜底 | ✅ 通过 | 970 → **1000**（修复前为 1120） |

#### 新增用例（验证工单退款修复）

| 编号 | 测试场景 | 结果 | 余额验证 |
|------|---------|------|---------|
| T5 | 扣费 150，局部退款 120（format 失败），状态置为 `needs_manual_review`，创建工单，调用 `admin_refund_needs_manual_review_and_resolve_ticket` | ✅ 通过 | 970 → **1000**（修复前为 1120） |
| T5.a | 工单状态变为 `resolved` | ✅ 通过 | — |
| T5.b | 审阅状态重置为 `pending`，`cost=0`，`refunded_amount=0` | ✅ 通过 | — |

**测试输出摘要（原始日志）**：
```
✅ Full refund (after partial). Balance: 1000 (Expected 1000)
   Status: pending (Expected pending)
   Cost: 0 (Expected 0)

✅ Ticket refund (after partial). Balance: 1000 (Expected 1000)
   Ticket status: resolved (Expected resolved)
   Review2 status: pending (Expected pending)
   Review2 cost: 0 (Expected 0)
   Review2 refunded_amount: 0 (Expected 0)

🎉 All tests finished.
```

### 5.4 最终结论

所有已知财务漏洞均已修复并通过回归测试。计费底层（扣费、局部退款、全额兜底退款、工单手动退款）在有/无局部退款的混合场景下余额计算完全正确，无超额退款风险。**Billing v2.0 后端计费底座状态：稳定可用。**