# 计费与点数系统详细设计方案 (Billing & Credits System Design)

**版本**: v1.1  
**基于文档**: `docs/AI_Thesis_Review_PRD_v2.0.md`, `docs/AI_Thesis_Review_Database_Schema_v2.0.md`  
**作者**: Colin  
**日期**: 2026-03-16

---

## 1. 概述 (Overview)

本方案旨在为 "AI 辅助论文智能审批网站" (MVP) 构建一个健壮、可扩展的计费与点数系统。
核心逻辑采用 **预付费点数 (Pre-paid Credits)** 模式，用户先充值购买点数，再根据论文页数消耗点数进行审阅。

**关键目标**:
1.  **准确性**: 确保资金流水 (Transactions) 零误差，每一笔变动可追溯。
2.  **灵活性**: 支持通过 JSON 配置动态调整套餐价格与消耗规则 (无需发版)。
3.  **安全性**: 集成 Zpay 支付，严格校验回调签名，防止伪造充值。
4.  **一致性**: 在高并发下保证余额扣减的原子性，防止余额负数。
5.  **闭环运维**: 结合工单系统 (Tickets) 实现异常任务的追踪与退款闭环。

---

## 2. 核心业务规则 (Business Rules)

### 2.1 套餐设计 (Packages)
*基于 PRD 5.2 & 5.6*
套餐配置应存储在远程配置 (Remote Config) 中，支持热更新。以下为 MVP 初始配置：

| 套餐名称 (Name) | 点数 (Credits) | 价格 (CNY) | 说明 |
| :--- | :--- | :--- | :--- |
| **Single Pass** | 1 | ¥9.9 | 单次体验，适合尝鲜 |
| **Standard Bundle** | 10 | ¥89.0 | 约9折，适合一般硕士论文反复修改 |
| **Pro Bundle** | 50 | ¥399.0 | 约8折，适合实验室团购或重度用户 |

### 2.2 消耗规则 (Consumption Rules)
*基于 PRD 5.2*
消耗点数由 **PDF 页数** 决定。

| 页数范围 (Page Count) | 消耗点数 (Cost) | 备注 |
| :--- | :--- | :--- |
| **< 60 页** | 1 点 | 标准本科/硕士论文 |
| **60 - 100 页** | 2 点 | 篇幅较长的硕士/博士论文 |
| **100 - 150 页** | 3 点 | 博士论文或超长附件 |
| **> 150 页** | 拒绝处理 / 5 点 | MVP 阶段建议前端拦截提示 "文件过大" |

---

## 3. 数据模型设计 (Database Schema)

利用 PostgreSQL (Supabase) 的强一致性特性。详细 Schema 见 `docs/AI_Thesis_Review_Database_Schema_v2.0.md`。

### 3.1 用户钱包表 (`user_wallets`)
在 `user_wallets` 表中存储余额与乐观锁。

```sql
create table public.user_wallets (
  user_id uuid not null references auth.users(id) on delete cascade primary key,
  credits_balance int not null default 0 check (credits_balance >= 0), -- 余额严禁为负
  version int not null default 0, -- 乐观锁版本号，防止并发扣费冲突
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3.2 订单表 (`orders`)
记录充值请求状态，支持 Zpay 对接。

```sql
create type order_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null, -- 对应 JSON 配置中的 ID
  amount_paid decimal(10, 2) not null, -- 实际支付金额 (CNY)
  credits_added int not null, -- 购买的点数
  status order_status default 'pending',
  provider_order_id text, -- Zpay 侧的订单号
  provider_payment_method text, -- 支付方式
  metadata jsonb, -- 额外信息
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3.3 资金流水表 (`credit_transactions`)
*基于 PRD 8.2*
**核心原则**: Append-only (仅追加)，不可物理删除。余额的每一次变动都必须在此表有一条记录。

```sql
create type transaction_type as enum (
  'deposit',          -- 充值
  'consumption',      -- 消费 (审阅)
  'refund',           -- 退款 (增加余额)
  'admin_adjustment', -- 管理员手动调整
  'bonus'             -- 活动赠送
);

create table public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null, -- 变动金额: +10, -1
  balance_before int not null, -- 变动前余额 (审计关键)
  balance_after int not null, -- 变动后余额 (审计关键)
  type transaction_type not null,
  reference_id text, -- 关联 ID: Order ID (充值) 或 Review ID (消费)
  metadata jsonb, -- 额外说明
  created_at timestamptz default now()
);
```

### 3.4 工单系统表 (`support_tickets`)
用于处理异常退款申请。

```sql
create table public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid references reviews(id) on delete set null,
  category ticket_category not null default 'general_inquiry',
  status ticket_status default 'open',
  resolution text, -- 记录退款操作结果
  -- ... 其他字段见 Database Schema v2.0
);
```

---

## 4. 接口与流程设计 (API & Workflow)

### 4.1 充值流程 (Deposit)
1.  **创建订单 (`POST /api/billing/create-order`)**:
    *   Input: `packageId`
    *   Logic:
        *   读取服务端配置，校验 `packageId` 有效性及价格。
        *   在 `orders` 表创建 `pending` 记录。
        *   调用 Zpay API 获取支付链接/二维码。
    *   Output: `paymentUrl`, `orderId`

2.  **支付回调 (`POST /api/billing/webhook/zpay`)**:
    *   Logic:
        *   **验签**: 校验 Zpay 签名，确保安全。
        *   **幂等**: 检查 `orders` 状态，若已 `paid` 则直接返回成功。
        *   **事务 (Transaction)**:
            1.  更新 `orders` 状态为 `paid`。
            2.  **查询当前余额** (`SELECT credits_balance FROM user_wallets FOR UPDATE`).
            3.  更新 `user_wallets` set `credits_balance = credits_balance + N`, `version = version + 1`。
            4.  插入 `credit_transactions` (Type: `deposit`, Amount: `+N`, BalanceBefore: `old`, BalanceAfter: `new`).
    *   Output: `success`

### 4.2 消费流程 (Consumption)
1.  **估算费用 (`POST /api/billing/estimate-cost`)**:
    *   Input: `pageCount`
    *   Logic: 根据配置规则计算所需点数。
    *   Output: `cost`

2.  **扣费并开始任务 (集成在 `POST /api/reviews/start`)**:
    *   Logic (在一个数据库事务中):
        *   **Lock & Check**: 查询并锁定用户钱包行。若 `balance < cost`，抛出 "Insufficient Funds"。
        *   **Deduct**:
            ```sql
            UPDATE user_wallets
            SET credits_balance = credits_balance - cost, version = version + 1
            WHERE user_id = :uid AND credits_balance >= cost
            RETURNING credits_balance;
            ```
        *   **Log**: 插入 `credit_transactions` (Type: `consumption`, Amount: `-cost`, Ref: `review_id`, BalanceBefore: `old`, BalanceAfter: `new`).
        *   **Start**: 创建审阅任务记录 (`status='pending'`, `cost=cost`).

### 4.3 退款/异常处理闭环 (Refund & Support Loop)
*基于 PRD 8.1 & Database Schema v2.0*

1.  **自动挂起**: 任务重试 3 次失败 -> 更新 `reviews.status` 为 `needs_manual_review` -> **自动创建高优先级工单 (`support_tickets`)**。
2.  **管理员处理**:
    *   管理员在后台查看工单及关联的 `llm_traces`。
    *   **分支 A (可修复)**: 修复 Prompt/参数 -> 强制重试任务 -> 更新工单状态为 `resolved`。
    *   **分支 B (需退款)**: 点击 "Refund" 按钮。
3.  **退款执行 (Admin Action)**:
    *   **API**: `POST /api/admin/refund-review`
    *   **Logic**:
        *   事务:
            1.  `user_wallets` 余额 `+cost`。
            2.  插入 `credit_transactions` (Type: `refund`, Amount: `+cost`, Ref: `review_id`, BalanceBefore: `old`, BalanceAfter: `new`).
            3.  更新 `reviews.status` 为 `refunded`。
            4.  更新 `support_tickets.status` 为 `resolved`, `resolution` 为 "Refunded X credits"。
            5.  (可选) 发送邮件通知用户。

---

## 5. 配置管理策略 (Configuration)

使用 JSON 文件存储策略，配合 Next.js ISR (Incremental Static Regeneration) 或简单的 API 缓存。

**配置文件结构示例 (`billing_config.json`)**:

```json
{
  "version": "1.0.0",
  "currency": "CNY",
  "packages": [
    {
      "id": "pkg_single",
      "name": "Single Pass",
      "credits": 1,
      "price": 990, // 单位: 分, 避免浮点误差
      "original_price": 1990,
      "tag": "Hot"
    },
    {
      "id": "pkg_standard",
      "name": "Standard Bundle",
      "credits": 10,
      "price": 8900,
      "original_price": 9900,
      "tag": "Best Value"
    }
  ],
  "consumption_rules": [
    { "max_pages": 60, "cost": 1 },
    { "max_pages": 100, "cost": 2 },
    { "max_pages": 150, "cost": 3 }
  ],
  "max_allowed_pages": 150
}
```

---

## 6. 安全与风控 (Security)

1.  **支付验签**: 必须使用 Zpay 提供的公钥/密钥严格校验 Webhook 签名。
2.  **并发控制**: 扣费操作必须使用数据库行锁或 `UPDATE ... WHERE balance >= cost` 原子操作。
3.  **日志审计**: `credit_transactions` 表严禁 Update/Delete 操作，只能 Insert。
4.  **价格防篡改**: 前端传 `packageId`，后端根据 ID 从配置取价格，**决不能**信任前端传来的 `price`。

## 7. 开发计划 (Action Plan)

1.  **Database**: 执行 `AI_Thesis_Review_Database_Schema_v2.0.md` 中的 SQL 脚本。
2.  **Config**: 在代码中定义 `billing-config.ts` 或 Supabase Storage JSON，并编写读取工具函数。
3.  **Backend API**:
    *   实现 Zpay 签名校验中间件。
    *   实现 `create-order` 和 `webhook`。
    *   实现 `TransactionManager` 类，封装扣费/退款的事务逻辑。
    *   实现工单自动创建逻辑 (Trigger or Server Action)。
4.  **Frontend**:
    *   构建 "PricingCard" 组件。
    *   集成 Zpay 支付跳转。
    *   上传文件后展示 "预计消耗点数"。
    *   构建 "Support Ticket" 查看入口 (用户侧 & 管理员侧)。
