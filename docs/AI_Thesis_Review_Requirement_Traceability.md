# AI 辅助论文智能审批系统需求规格追踪 (RTM) V2.0

| 文档属性 | 描述 |
| :--- | :--- |
| **项目名称** | AI 辅助论文智能审批系统 (MVP) |
| **文档版本** | V2.0 |
| **关联 PRD** | [AI_Thesis_Review_PRD_v2.0.md](./AI_Thesis_Review_PRD_v2.0.md) |
| **关联架构** | [AI_Thesis_Review_Architecture_Design.md](./AI_Thesis_Review_Architecture_Design.md) |
| **关联技术方案** | [Tech_Spec_Auth_v1.0.md](./Tech_Spec_Auth_v1.0.md)、[Tech_Spec_Billing_v1.0.md](./Tech_Spec_Billing_v1.0.md)、[Tech_Spec_Admin_Config_v1.0.md](./Tech_Spec_Admin_Config_v1.0.md)、[Tech_Spec_AI_Review_1_UI.md](./Tech_Spec_AI_Review_1_UI.md)、[Tech_Spec_AI_Review_2_Trigger.md](./Tech_Spec_AI_Review_2_Trigger.md)、[Tech_Spec_AI_Review_3_Engine.md](./Tech_Spec_AI_Review_3_Engine.md) |
| **作者** | Colin |
| **最后更新** | 2026-03-27 |

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
| **FR-02-03** | 消耗规则 (按字数扣点) | **ConfigService** + **Supabase Storage** + **estimate-cost API** + **审阅启动扣费 RPC** | ✅ 已实现 | 按字数阶梯扣费（<2w: 1点, 2-5w: 2点, >5w: 3点）。`lib/config/billing.ts`、`POST /api/billing/estimate-cost`；**开始审阅**时由 **`start_review_and_deduct`** RPC 原子扣点；Trigger 派发失败时 **`rollback_review_after_dispatch_failure`** 退款 |
| **FR-02-04** | 资金流水日志 (`credit_transactions`) | **Supabase Database** (`credit_transactions` table) | ✅ 已实现 | `add_credits_deposit`（充值）、`app/api/billing/webhook/zpay`；审阅 **`consumption`** 见 **`start_review_and_deduct`**，Trigger 失败 **`refund`** 见 **`rollback_review_after_dispatch_failure`** |

### FR-03: 论文上传与解析 (Upload & Parsing)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-03-01** | DOCX 文件拖拽上传 | **Frontend** (Upload Component) + **Supabase Storage** | ✅ 已实现 | 全面迁移至 DOCX，私有 Bucket **`thesis-docxs`**；上传经 `lib/dal/storage.dal.ts`（Service Role）；`lib/actions/review.action.ts` `initializeReview` |
| **FR-03-02** | 前端解析字数 (预估费用) | **Frontend** (`mammoth.js` 方案) | ✅ 已实现 | `lib/browser/docx-word-count.ts`（若适用）；字数经表单字段提交服务端校验并算费 |
| **FR-03-03** | 后端文本/样式提取 | **Trigger.dev Job** + **Hybrid DOCX Parser** | ✅ 已实现 | `lib/review/hybrid-docx-parser.ts`；结合 `mammoth.js` (Markdown/Images) 与 `OpenXML` (Style AST) 双管齐下，`sharp` 压缩图片防 OOM |

### FR-04: AI 智能审阅 (Agentic Review)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-04-01** | 多智能体协作 (Coordinator/Format/Logic/Ref) | **Trigger.dev** `orchestrate-review` + **`Promise.all`** 三 agent | ✅ 已实现 (MVP) | `trigger/review-orchestrator.ts`；**`stages` 回写**经 **`admin_patch_review_stage`** RPC 原子更新，避免并行覆盖 |
| **FR-04-02** | 格式规范检查 (GB/T) | **Rule Engine** + **Semantic Map-Reduce** | ✅ 已实现 | 双轨制：物理轨基于 OpenXML Style AST 和 JSON 规则引擎 (`format-rules.engine.ts`) 逐段校验；语义轨基于 Map-Reduce 按章分块 (`format.service.ts`) |
| **FR-04-03** | 逻辑深度分析 (Logic Agent) | **OpenRouter** (Two-Pass Map-Reduce) | ✅ 已实现 | `lib/services/review/logic.service.ts`，基于 Two-Pass 架构实现长文本落地的逻辑连贯性分析 |
| **FR-04-04** | 参考文献核查 (多源/双轨) | **Crossref/OpenAlex** + **LLM Fact Check** | ✅ 已实现 | 双轨核查：事实轨通过 Crossref 匹配 (`crossref-client.ts`) 引入 `suspected` 状态防幻觉；格式轨校验 GB/T 7714 规范 (`reference.service.ts`) |
| **FR-04-05** | 对话式引导输入 (Conversational UI) | **Frontend** (气泡流 + Zustand) + **Server Actions** | ✅ 已实现 (MVP) | `ReviewWorkbench` / `ReviewChatBoard` / `useDashboardStore`；**`startReviewEngine`** 经 RPC 扣费 + `tasks.trigger`；终态时 Realtime **`router.refresh()`** 同步 |
| **FR-04-06** | AI 痕迹预警 (AI Trace) | **Map-Reduce (按字数切块)** | ✅ 已实现 | `lib/services/review/aitrace.service.ts`，按字数（如2000字）切块高分辨率检测词汇/句法级别的 AI 生成痕迹 |

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

1.  **报告生成与导出**:
    *   **Gap**: 架构只负责生成 JSON 结构化数据，目前仅在 `ReportViewer.tsx` 呈现，尚未打通美观的 PDF 报告导出链路。
    *   **Action**: 需决定在前端 (`@react-pdf/renderer`) 生成还是后端 (Puppeteer/HTML-to-PDF) 生成。

2.  **对话式引导状态管理**:
    *   **状态**: 工作台已用 **Zustand 气泡链** + Server Actions 覆盖上传、领域、静态计划、开始审阅；当前采用预设流程，未使用 Vercel AI SDK `useChat`。
    *   **余量**: 若后续产品演进要求引入真正的多轮自由对话（例如：用户提出自定义侧重点），再评估重构接入对话 API。

3.  **高并发触发的重试与状态流转补偿**:
    *   **状态**：引擎编排与子任务 (Map-Reduce) 已全面接入 Trigger.dev (`generic-llm-batch-task` 队列管控防 429)。
    *   **余量**：`tasks.trigger` 成功但 `updateTriggerRunId` 落库失败的边缘情况，当前暂以返回 `START_FAILED` 且不自动退费处理，后续需加强最终一致性补偿（如定时脚本对账）。

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
| **AI 审阅引擎基础与逻辑审查** | [Tech_Spec_AI_Review_3_Engine.md](./Tech_Spec_AI_Review_3_Engine.md) | [issues/2026-03-24+AI审阅引擎3.1_OpenRouter客户端.md](../issues/2026-03-24+AI审阅引擎3.1_OpenRouter客户端.md) | 2026-03-24 |
| **参考文献多源核查引擎** | 见上述 3_Engine 规范 | [issues/2026-03-24+参考文献多源核查3.5.md](../issues/2026-03-24+参考文献多源核查3.5.md) | 2026-03-24 |
| **Hybrid DOCX 文件解析** | [Tech_Spec_AI_Review_4_DOCX_Migration.md](./Tech_Spec_AI_Review_4_DOCX_Migration.md) | [issues/2026-03-25+Hybrid_Parser_2.1_DOCX双管齐下.md](../issues/2026-03-25+Hybrid_Parser_2.1_DOCX双管齐下.md) | 2026-03-25 |
| **格式审查双轨制与规则引擎** | [Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md](./Tech_Spec_AI_Review_5_Format_Physical_Schema_Refactor.md) | [issues/2026-03-26+Format_Service_双轨制.md](../issues/2026-03-26+Format_Service_双轨制.md) | 2026-03-26 |
| **AI痕迹与格式语义Map-Reduce** | [Tech_Spec_AI_Review_6_Format_Semantic_MapReduce.md](./Tech_Spec_AI_Review_6_Format_Semantic_MapReduce.md) | [issues/2026-03-26+AITrace_3.3_段落切块.md](../issues/2026-03-26+AITrace_3.3_段落切块.md) | 2026-03-26 |
