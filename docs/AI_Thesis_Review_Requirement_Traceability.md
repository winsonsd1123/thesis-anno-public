# AI 辅助论文智能审批系统需求规格追踪 (RTM) V2.0

| 文档属性 | 描述 |
| :--- | :--- |
| **项目名称** | AI 辅助论文智能审批系统 (MVP) |
| **文档版本** | V1.0 |
| **关联 PRD** | [AI_Thesis_Review_PRD_v2.0.md](./AI_Thesis_Review_PRD_v2.0.md) |
| **关联架构** | [AI_Thesis_Review_Architecture_Design.md](./AI_Thesis_Review_Architecture_Design.md) |
| **作者** | Colin |
| **最后更新** | 2026-03-15 |

---

## 1. 功能需求追踪 (Functional Requirements Traceability)

### FR-01: 用户认证与管理 (User Authentication)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01-01** | 支持邮箱/密码注册登录 | **Supabase Auth** (Email provider) | ✅ 已设计 | - |
| **FR-01-02** | 支持 OAuth (Google/GitHub) | **Supabase Auth** (Social providers) | ✅ 已设计 | 需要在 Supabase 控制台配置 Client ID/Secret |
| **FR-01-03** | 数据隔离 (RLS) | **Supabase RLS Policies** | ✅ 已设计 | `reviews` 表需配置 `auth.uid() = user_id` |

### FR-02: 计费与点数 (Billing & Credits)

| 需求 ID | PRD 描述 | 架构实现 (Component/Service) | 状态 | 备注/Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **FR-02-01** | 点数账户 (Credits) 模型 | **Supabase Database** (`public.users` table, `credits` column) | ⚠️ 待细化 | 架构文档未详细定义 `users` 表结构及 `credits` 字段 |
| **FR-02-02** | 套餐购买 (1次/10次/50次) | **Frontend** (Pricing Page) + **Zpay Integration** | ⚠️ 待设计 | 架构文档未包含支付回调 (Webhook) 处理逻辑 |
| **FR-02-03** | 消耗规则 (按页数扣点) | **Trigger.dev Job** (Pre-check step) | ✅ 已设计 | 需要在 `review.ts` 的解析步骤后加入扣费逻辑 |
| **FR-02-04** | 资金流水日志 (`credit_transactions`) | **Supabase Database** (`credit_transactions` table) | ❌ 未设计 | 架构文档完全遗漏了流水表设计 |

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

1.  **支付回调与流水记录**:
    *   **Gap**: 架构完全未提及 `credit_transactions` 表和支付 Webhook 处理逻辑。
    *   **Action**: 需补充 `webhook/zpay` API 设计及数据库流水表结构。

2.  **参考文献联网校验**:
    *   **Gap**: PRD 要求“真实性核查”，单纯靠 LLM 幻觉严重，架构未提及引入 Search API。
    *   **Action**: 需在 `checkReference` Agent 中集成 Tavily 或 Google Search API。

3.  **PDF 报告生成**:
    *   **Gap**: 架构只负责生成 JSON 数据，未定义如何将 JSON 转为美观的 PDF 报告。
    *   **Action**: 决定在前端 (`@react-pdf/renderer`) 生成还是后端 (Puppeteer) 生成。

4.  **对话式引导状态管理**:
    *   **Gap**: PRD 的 Step 1 是复杂的对话交互，架构主要描述了 Step 2 之后的异步任务。
    *   **Action**: 前端需设计 `useChat` 或类似的状态机来管理上传前的引导对话。
