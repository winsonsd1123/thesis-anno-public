# AI 辅助论文智能审批系统需求规格追踪 (RTM) V2.0

| 文档属性 | 描述 |
| :--- | :--- |
| **项目名称** | AI 辅助论文智能审批系统 (MVP) |
| **文档版本** | V2.0 |
| **关联 PRD** | [AI_Thesis_Review_PRD_v2.0.md](./AI_Thesis_Review_PRD_v2.0.md) |
| **关联架构** | [AI_Thesis_Review_Architecture_Design.md](./AI_Thesis_Review_Architecture_Design.md) |
| **关联技术方案** | [Tech_Spec_Auth_v1.0.md](./Tech_Spec_Auth_v1.0.md)、[Tech_Spec_Billing_v1.0.md](./Tech_Spec_Billing_v1.0.md)、[Tech_Spec_Admin_Config_v1.0.md](./Tech_Spec_Admin_Config_v1.0.md)、[Tech_Spec_AI_Review_1_UI.md](./Tech_Spec_AI_Review_1_UI.md)、[Tech_Spec_AI_Review_2_Trigger.md](./Tech_Spec_AI_Review_2_Trigger.md)、[Tech_Spec_AI_Review_3_Engine.md](./Tech_Spec_AI_Review_3_Engine.md) |
| **作者** | Colin |
| **最后更新** | 2026-03-22 |

---

## 1. 功能需求追踪 (Functional Requirements Traceability)

### FR-01: 用户认证与管理 (User Authentication)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 实现追踪 |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01-01** | 支持邮箱/密码注册登录 | **Supabase Auth** + **Server Actions** | ✅ 已实现 | `lib/actions/auth.actions.ts` (signUp/signIn)、`lib/dal/auth.dal.ts`、`app/[locale]/(auth)/login`、`register` |
| **FR-01-02** | 支持 OAuth (Google/GitHub) | **Supabase Auth** (Social providers) | ✅ 已实现 | `signInWithOAuth`、`app/auth/callback/route.ts`。需在 Supabase 控制台配置 Client ID/Secret |
| **FR-01-03** | 数据隔离 (RLS) | **Supabase RLS Policies** | ✅ 已实现 | `profiles` 已配置；`reviews` 已配置 `SELECT` 及用户态 `INSERT`/`UPDATE`/`DELETE`（`auth.uid() = user_id`），见 `docs/sql/reviews_rls_user_insert_update_delete.sql` |
| **FR-01-04** | 个人档案 (头像、昵称) | **Profile DAL/Service** + **Dashboard Settings** | ✅ 已实现 | `lib/dal/profile.dal.ts`、`lib/actions/profile.actions.ts`、`app/[locale]/dashboard/settings`、`AvatarUpload` 组件 |
| **FR-01-05** | 密码重置 (找回密码) | **resetPasswordForEmail** + **updateUser** | ✅ 已实现 | `forgot-password`、`update-password` 页面，回调 `/auth/callback?next=/update-password` |
| **FR-01-06** | 会话管理与路由保护 | **Middleware** + **Supabase SSR** | ✅ 已实现 | `middleware.ts`、`lib/supabase/middleware.ts`，未登录访问 `/dashboard` 重定向 `/login` |

### FR-02: 计费与点数 (Billing & Credits)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-02-01** | 点数账户 (Credits) 模型 | **Supabase Database** (`user_wallets` / `credits_balance`) | ✅ 已实现 | `lib/dal/wallet.dal.ts`、`lib/services/transaction.service.ts`、`add_credits_deposit` 存储过程 |
| **FR-02-02** | 套餐购买 (1次/10次/50次) | **Frontend** (Pricing Page) + **Zpay submit.php** | ✅ 已实现 | `lib/services/zpay.service.ts`、`lib/actions/billing.actions.ts`、`app/[locale]/dashboard/billing`、`PricingCard` 组件 |
| **FR-02-03** | 消耗规则 (按页数扣点) | **ConfigService** + **Supabase Storage** + **estimate-cost API** + **审阅启动扣费 RPC** | ✅ 已实现 | `lib/config/billing.ts`、`POST /api/billing/estimate-cost`；**开始审阅**时由 **`start_review_and_deduct`**（Supabase RPC）与 `estimateCost` 对齐后原子扣点并写流水（`consumption`）；Trigger 派发失败时 **`rollback_review_after_dispatch_failure`** 退款回 `pending` |
| **FR-02-04** | 资金流水日志 (`credit_transactions`) | **Supabase Database** (`credit_transactions` table) | ✅ 已实现 | `add_credits_deposit`（充值）、`app/api/billing/webhook/zpay`；审阅 **`consumption`** 见 **`start_review_and_deduct`**，Trigger 失败 **`refund`** 见 **`rollback_review_after_dispatch_failure`** |

### FR-03: 论文上传与解析 (Upload & Parsing)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-03-01** | PDF 文件拖拽上传 | **Frontend** (Upload Component) + **Supabase Storage** | ✅ 已实现 | 私有 Bucket **`thesis-pdfs`**；上传经 `lib/dal/storage.dal.ts`（Service Role）；`lib/actions/review.action.ts` `initializeReview` |
| **FR-03-02** | 前端解析页码 (预估费用) | **Frontend** (`pdfjs-dist`) | ✅ 已实现 | `lib/browser/pdf-page-count.ts`；页数经表单字段提交服务端校验（`getMaxAllowedPages`） |
| **FR-03-03** | 后端文本提取 | **Trigger.dev Job** + **`pdf-parse` 降级** | ✅ 已实现 (MVP) | `lib/dal/storage.dal.ts` `downloadReviewPdf`；`trigger/utils/pdf-extractor.ts` `executeWithFallback`；编排内懒加载 `pdf-parse`（多模态失败时纯文本路径） |

### FR-04: AI 智能审阅 (Agentic Review)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-04-01** | 多智能体协作 (Coordinator/Format/Logic/Ref) | **Trigger.dev** `orchestrate-review` + **`Promise.all`** 三 agent | ✅ 已实现 (MVP) | `trigger/review-orchestrator.ts`；**`stages` 回写**经 **`admin_patch_review_stage`** RPC 原子更新，避免并行覆盖 |
| **FR-04-02** | 格式规范检查 (GB/T) | **OpenRouter** (Prompt Engineering) | ⚠️ 桩 + 待 Engine | `lib/services/review/format.service.ts` 当前为 **stub**；真 LLM 见 `Tech_Spec_AI_Review_3_Engine.md` |
| **FR-04-03** | 逻辑深度分析 (Logic Agent) | **OpenRouter** (Long Context LLM) | ⚠️ 桩 + 待 Engine | `lib/services/review/logic.service.ts` **stub** |
| **FR-04-04** | 参考文献核查 (联网/数据库) | **OpenRouter** (Search Tool / RAG) | ⚠️ 桩 + 待细化 | `lib/services/review/reference.service.ts` **stub**；联网检索与 Spec 3 待集成 |
| **FR-04-05** | 对话式引导输入 (Conversational UI) | **Frontend** (气泡流 + Zustand) + **Server Actions** | ✅ 已实现 (MVP) | `ReviewWorkbench` / `ReviewChatBoard` / `useDashboardStore`；**`startReviewEngine`**（`lib/actions/trigger.action.ts`）经 RPC 扣费 + `tasks.trigger`；终态时 Realtime **`router.refresh()`** 同步历史侧栏 |

### FR-05: 结果呈现与下载 (Result & Export)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-05-01** | 实时进度展示 (Real-time Stream) | **Supabase Realtime** (Postgres Changes) | ✅ 已实现 | `lib/hooks/useReviewRealtime.ts`；`processing` 时订阅 **`reviews`**；终态 **`router.refresh()`** 刷新 RSC 历史列表（避免仅 Zustand 更新、侧栏滞后） |
| **FR-05-02** | 分 Tab 结果页 (总览/逻辑/格式/引用) | **Frontend** (Tabs) + **`result` JSONB** | ⚠️ 部分实现 | `ReportViewer.tsx` 三 Tab 展示 `format_result` / `logic_result` / `reference_result`，当前为 **JSON 文本**；富文本/结构化渲染待增强 |
| **FR-05-03** | PDF 报告下载 | **Frontend** (`react-pdf` / `jspdf`) | ⚠️ 待设计 | 架构未提及 PDF 生成服务 (前端生成 vs 后端生成) |
| **FR-05-04** | Markdown 源码下载 | **Frontend** (Direct Download) | ⚠️ 部分实现 | 当前 `ReportViewer` 导出为 **JSON 文件** (`thesis-review-report.json`)；Markdown 导出待产品确认格式后再做 |

### FR-06: 后台管理与配置 (Admin & Configuration)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 实现追踪 |
| :--- | :--- | :--- | :--- | :--- |
| **FR-06-01** | Prompt 实验室 (Prompt Lab) | **ConfigService** + **Supabase Storage** + **Admin UI** | ✅ 已实现 | `lib/services/config.service.ts`、`lib/services/prompt.service.ts`、`app/[locale]/admin/config/prompts`、`prompts.json` |
| **FR-06-02** | 计费配置 (Pricing Config) | **ConfigService** + **Admin UI** | ✅ 已实现 | `app/[locale]/admin/config/pricing`、`billing.json`，首页与 Dashboard 均从 Storage 动态读取 |
| **FR-06-03** | 系统熔断 (Feature Flags) | **ConfigService** + **Admin UI** | ✅ 已实现 | `app/[locale]/admin/config/system`、`system.json` |
| **FR-06-04** | 配置热更新 (Hot Reload) | **Next.js Revalidation** | ✅ 已实现 | `unstable_cache` + `revalidateTag(key, { expire: 0 })`，Admin 保存后立即生效 |

---

## 2. 非功能需求追踪 (NFR Traceability)

| 需求 ID | 类别 | PRD 描述 | 架构实现策略 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-01** | **性能** | 完整审阅 < 5分钟 | **Trigger.dev (Serverless Background Jobs)** | ✅ 达标 (并行执行显著降低耗时) |
| **NFR-02** | **可靠性** | 自动重试与异常熔断 | **Trigger.dev Auto-Retry** | ✅ 达标 (自带指数退避重试) |
| **NFR-03** | **可靠性** | 人工工单介入 (Suspend & Ticket) | **`reviewAdminDAL.suspendToManualReview`** + **`support_tickets`** | ⚠️ 部分实现（编排失败写 `needs_manual_review` 并插工单；管理员通知/队列 UI 待办） |
| **NFR-04** | **体验** | 300s 超时规避 | **Async Architecture** | ✅ 完美解决 (Vercel 仅触发，Trigger.dev 跑长任务) |
| **NFR-05** | **UI/UX** | 深色模式 (Dark Mode) | **next-themes** + **Tailwind CSS** | ✅ 标准实现 |
| **NFR-06** | **I18n** | 国际化架构先行 | **next-intl** | ✅ 标准实现 |

---

## 3. 关键缺失 (Critical Gaps) & 待办

基于上述分析，以下是架构设计中目前 **缺失或未详细定义** 的高风险项：

1.  **参考文献联网校验**:
    *   **Gap**: PRD 要求“真实性核查”，单纯靠 LLM 幻觉严重，架构未提及引入 Search API。
    *   **Action**: 需在 `checkReference` Agent 中集成 Tavily 或 Google Search API。

2.  **PDF 报告生成**:
    *   **Gap**: 架构只负责生成 JSON 数据，未定义如何将 JSON 转为美观的 PDF 报告。
    *   **Action**: 决定在前端 (`@react-pdf/renderer`) 生成还是后端 (Puppeteer) 生成。

3.  **对话式引导状态管理**:
    *   **状态**: 工作台已用 **Zustand 气泡链** + Server Actions 覆盖上传、领域、静态计划、开始审阅；未使用 Vercel AI SDK `useChat`。
    *   **余量**: 若产品要求多轮 LLM 引导，再评估是否引入对话 API。

4.  **核心审阅流程集成**:
    *   **状态 (2026-03-22)**：已按 **`Tech_Spec_AI_Review_2_Trigger.md`** 接通 **`start_review_and_deduct`**、`tasks.trigger("orchestrate-review")`、`review.admin.dal`（含 **`admin_patch_review_stage`**）、**`rollback_review_after_dispatch_failure`**（Trigger 失败回 `pending` + 退款）、`trigger/review-orchestrator.ts` + 桩 Engine。
    *   **余量**：**Spec 3** 真 LLM/OpenRouter 审阅引擎、参考文献联网检索、**`tasks.trigger` 成功但 `updateTriggerRunId` 失败** 的补偿策略（当前返回 `START_FAILED`，不自动 rollback）。

---

## 4. 实现记录 (Implementation Log)

| 模块 | 技术方案 | 完成记录 | 完成日期 |
| :--- | :--- | :--- | :--- |
| **用户认证与档案** | [Tech_Spec_Auth_v1.0.md](./Tech_Spec_Auth_v1.0.md) | [issues/2026-03-15+Auth_Profile模块开发.md](../issues/2026-03-15+Auth_Profile模块开发.md) | 2026-03-15 |
| **i18n 国际化** | [Tech_Spec_i18n_Plugin_v1.0.md](./Tech_Spec_i18n_Plugin_v1.0.md) | [issues/2026-03-15+i18n国际化开发.md](../issues/2026-03-15+i18n国际化开发.md) | 2026-03-15 |
| **计费与点数** | [Tech_Spec_Billing_v1.0.md](./Tech_Spec_Billing_v1.0.md) | [issues/2026-03-16+计费模块开发.md](../issues/2026-03-16+计费模块开发.md) | 2026-03-16 |
| **后台管理与配置** | [Tech_Spec_Admin_Config_v1.0.md](./Tech_Spec_Admin_Config_v1.0.md) | [issues/2026-03-17+Admin_Config_工作记录.md](../issues/2026-03-17+Admin_Config_工作记录.md) | 2026-03-17 |
| **AI 审阅工作台 (UI 方案 1/3)** | [Tech_Spec_AI_Review_1_UI.md](./Tech_Spec_AI_Review_1_UI.md) | [issues/2026-03-21+AI审阅工作台.md](../issues/2026-03-21+AI审阅工作台.md) | 2026-03-21 |
| **AI 审阅 Trigger 编排与一致性** | [Tech_Spec_AI_Review_2_Trigger.md](./Tech_Spec_AI_Review_2_Trigger.md) | [issues/2026-03-22+AI审阅Trigger编排与一致性.md](../issues/2026-03-22+AI审阅Trigger编排与一致性.md) | 2026-03-22 |
