# AI 辅助论文智能审批系统需求规格追踪 (RTM) V2.0

| 文档属性 | 描述 |
| :--- | :--- |
| **项目名称** | AI 辅助论文智能审批系统 (MVP) |
| **文档版本** | V2.0 |
| **关联 PRD** | [AI_Thesis_Review_PRD_v2.0.md](./AI_Thesis_Review_PRD_v2.0.md) |
| **关联架构** | [AI_Thesis_Review_Architecture_Design.md](./AI_Thesis_Review_Architecture_Design.md) |
| **关联技术方案** | [Tech_Spec_Auth_v1.0.md](./Tech_Spec_Auth_v1.0.md)、[Tech_Spec_Billing_v1.0.md](./Tech_Spec_Billing_v1.0.md)、[Tech_Spec_Admin_Config_v1.0.md](./Tech_Spec_Admin_Config_v1.0.md) |
| **作者** | Colin |
| **最后更新** | 2026-03-17 |

---

## 1. 功能需求追踪 (Functional Requirements Traceability)

### FR-01: 用户认证与管理 (User Authentication)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 实现追踪 |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01-01** | 支持邮箱/密码注册登录 | **Supabase Auth** + **Server Actions** | ✅ 已实现 | `lib/actions/auth.actions.ts` (signUp/signIn)、`lib/dal/auth.dal.ts`、`app/[locale]/(auth)/login`、`register` |
| **FR-01-02** | 支持 OAuth (Google/GitHub) | **Supabase Auth** (Social providers) | ✅ 已实现 | `signInWithOAuth`、`app/auth/callback/route.ts`。需在 Supabase 控制台配置 Client ID/Secret |
| **FR-01-03** | 数据隔离 (RLS) | **Supabase RLS Policies** | ✅ 已设计 | `profiles` 表 RLS 已配置；`reviews` 表需配置 `auth.uid() = user_id` |
| **FR-01-04** | 个人档案 (头像、昵称) | **Profile DAL/Service** + **Dashboard Settings** | ✅ 已实现 | `lib/dal/profile.dal.ts`、`lib/actions/profile.actions.ts`、`app/[locale]/dashboard/settings`、`AvatarUpload` 组件 |
| **FR-01-05** | 密码重置 (找回密码) | **resetPasswordForEmail** + **updateUser** | ✅ 已实现 | `forgot-password`、`update-password` 页面，回调 `/auth/callback?next=/update-password` |
| **FR-01-06** | 会话管理与路由保护 | **Middleware** + **Supabase SSR** | ✅ 已实现 | `middleware.ts`、`lib/supabase/middleware.ts`，未登录访问 `/dashboard` 重定向 `/login` |

### FR-02: 计费与点数 (Billing & Credits)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-02-01** | 点数账户 (Credits) 模型 | **Supabase Database** (`user_wallets` / `credits_balance`) | ✅ 已实现 | `lib/dal/wallet.dal.ts`、`lib/services/transaction.service.ts`、`add_credits_deposit` 存储过程 |
| **FR-02-02** | 套餐购买 (1次/10次/50次) | **Frontend** (Pricing Page) + **Zpay submit.php** | ✅ 已实现 | `lib/services/zpay.service.ts`、`lib/actions/billing.actions.ts`、`app/[locale]/dashboard/billing`、`PricingCard` 组件 |
| **FR-02-03** | 消耗规则 (按页数扣点) | **ConfigService** + **Supabase Storage** + **estimate-cost API** | ✅ 已实现 | `lib/config/billing.ts` 从 Storage 读取、`ConfigService`、`POST /api/billing/estimate-cost`；扣费逻辑待集成 `review.ts` |
| **FR-02-04** | 资金流水日志 (`credit_transactions`) | **Supabase Database** (`credit_transactions` table) | ✅ 已实现 | `add_credits_deposit` 存储过程、`app/api/billing/webhook/zpay` |

### FR-03: 论文上传与解析 (Upload & Parsing)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-03-01** | PDF 文件拖拽上传 | **Frontend** (Upload Component) + **Supabase Storage** | ✅ 已设计 | Bucket: `thesis-files` |
| **FR-03-02** | 前端解析页码 (预估费用) | **Frontend** (`pdf.js` / `react-pdf`) | ⚠️ 待确认 | 架构未明确前端解析库选型，需确认是否在前端做 Pre-check |
| **FR-03-03** | 后端文本提取 | **Trigger.dev Job** (`pdf-parse` / `unstructured`) | ✅ 已设计 | `downloadAndParse` 函数 |

### FR-04: AI 智能审阅 (Agentic Review)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-04-01** | 多智能体协作 (Coordinator/Format/Logic/Ref) | **Trigger.dev Parallel Fan-out** (`Promise.all`) | ✅ 已设计 | 架构采用并行模式，非串行 Agent，更高效 |
| **FR-04-02** | 格式规范检查 (GB/T) | **OpenRouter** (Prompt Engineering) | ✅ 已设计 | 对应 `checkFormat` 函数 |
| **FR-04-03** | 逻辑深度分析 (Logic Agent) | **OpenRouter** (Long Context LLM) | ✅ 已设计 | 对应 `checkLogic` 函数 |
| **FR-04-04** | 参考文献核查 (联网/数据库) | **OpenRouter** (Search Tool / RAG) | ⚠️ 待细化 | 架构中仅提到 LLM 调用，未明确是否集成 Search API (如 Tavily/Serper) |
| **FR-04-05** | 对话式引导输入 (Conversational UI) | **Frontend** (Chat Interface) + **API Route** | ⚠️ 待设计 | 架构重点在后台任务，前端交互逻辑需补充 |

### FR-05: 结果呈现与下载 (Result & Export)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-05-01** | 实时进度展示 (Real-time Stream) | **Supabase Realtime** (Postgres Changes) | ✅ 已设计 | 监听 `reviews` 表 `stages` 字段变更 |
| **FR-05-02** | 分 Tab 结果页 (总览/逻辑/格式/引用) | **Frontend** (Tabs Component) + **JSON Schema** | ✅ 已设计 | 数据库 `result` JSON 结构已预留 |
| **FR-05-03** | PDF 报告下载 | **Frontend** (`react-pdf` / `jspdf`) | ⚠️ 待设计 | 架构未提及 PDF 生成服务 (前端生成 vs 后端生成) |
| **FR-05-04** | Markdown 源码下载 | **Frontend** (Direct Download) | ✅ 已设计 | 直接将 JSON 转 MD 即可 |

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
| **NFR-03** | **可靠性** | 人工工单介入 (Suspend & Ticket) | **Trigger.dev Error Handling** | ⚠️ 部分设计 (需集成工单系统通知) |
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
    *   **Gap**: PRD 的 Step 1 是复杂的对话交互，架构主要描述了 Step 2 之后的异步任务。
    *   **Action**: 前端需设计 `useChat` 或类似的状态机来管理上传前的引导对话。

4.  **核心审阅流程集成**:
    *   **Gap**: 虽然 `Trigger.dev` SDK 已安装，但核心的上传、解析、审阅 Job 定义尚未实现。
    *   **Action**: 需开发 `lib/trigger/review.ts` 并打通 Frontend Upload -> Storage -> Trigger 链路.

---

## 4. 实现记录 (Implementation Log)

| 模块 | 技术方案 | 完成记录 | 完成日期 |
| :--- | :--- | :--- | :--- |
| **用户认证与档案** | [Tech_Spec_Auth_v1.0.md](./Tech_Spec_Auth_v1.0.md) | [issues/2026-03-15+Auth_Profile模块开发.md](../issues/2026-03-15+Auth_Profile模块开发.md) | 2026-03-15 |
| **i18n 国际化** | [Tech_Spec_i18n_Plugin_v1.0.md](./Tech_Spec_i18n_Plugin_v1.0.md) | [issues/2026-03-15+i18n国际化开发.md](../issues/2026-03-15+i18n国际化开发.md) | 2026-03-15 |
| **计费与点数** | [Tech_Spec_Billing_v1.0.md](./Tech_Spec_Billing_v1.0.md) | [issues/2026-03-16+计费模块开发.md](../issues/2026-03-16+计费模块开发.md) | 2026-03-16 |
| **后台管理与配置** | [Tech_Spec_Admin_Config_v1.0.md](./Tech_Spec_Admin_Config_v1.0.md) | [issues/2026-03-17+Admin_Config_工作记录.md](../issues/2026-03-17+Admin_Config_工作记录.md) | 2026-03-17 |
