# AI 辅助论文智能审批网站 PRD V2.0 (MVP)

| 版本号 | 修订日期 | 修改描述 | 作者 |
| :--- | :--- | :--- | :--- |
| V2.0 | 2026-03-14 | 初始版本：AI 辅助论文智能审批系统详细设计 | Colin |
| V2.1 | 2026-03-14 | MVP 范围聚焦：**中文毕业论文**；强调国际化架构先行 | Colin |
| V2.2 | 2026-03-14 | 计费模式细化：**点数套餐制 (Credits)**，放弃订阅制 | Colin |
| V2.3 | 2026-03-14 | 交互重构：**多智能体协作展示**、**异步会话管理**、**分 Tab 结果页** | Colin |
| V2.4 | 2026-03-14 | 交互优化：**对话式引导输入 (Conversational UI)** 替代传统表单 | Colin |
| V2.5 | 2026-03-14 | 稳定性增强：**异常熔断机制**、**自动退款策略**与**全链路日志审计** | Colin |
| V2.6 | 2026-03-14 | 运维策略调整：**人工工单介入**替代自动退款，强化早期 Bad Case 追踪 | Colin |
| V2.7 | 2026-03-14 | UI 体验升级：**日夜主题切换 (Dark Mode)** 与系统跟随策略 | Colin |

---

## 1. 项目背景与目标 (Project Background)

本项目旨在打造一个**自动化、智能化、高并发**的论文审阅 SaaS 平台。
**MVP 阶段战略定位**：首先攻克**中文毕业论文**这一高频刚需场景，打磨核心 AI 审阅引擎与 Gemini 风格的交互体验。
**架构愿景**：Day 1 即引入国际化 (i18n) 与插件化架构，为后续快速迭代至**英文学位论文**、**期刊/会议论文**做好充分准备。

**核心价值主张：**
- **深度审阅**：针对毕业论文的特殊性（结构完整性、格式规范、致谢、引用），提供“导师级”预审。
- **可视化思考**：让用户看到 AI “阅读”和“思考”的过程，提升信任感。
- **全球化架构**：虽然 MVP 仅开放中文界面，但底层代码完全支持多语言切换。

---

## 2. 迭代路线图 (Roadmap)

### Phase 1: MVP (当前版本)
- **目标用户**：中文高校毕业生（本科/硕士/博士）。
- **核心功能**：
    - 中文毕业论文全流程审阅（含英文摘要润色）。
    - **点数计费系统**：支持单次、10次、50次套餐购买。
    - Zpay 支付集成（代码层预留国际支付接口）。
    - **Gemini Deep Research 风格交互**：多智能体协作可视化，异步会话管理。
    - **架构先行**：完整 i18n 基础设施（next-intl），但仅开放中文。

### Phase 2: 英文学位论文 (Planned)
- **新增能力**：
    - 英文学位论文格式库 (APA, MLA, Harvard)。
    - Grammarly 级别的学术语法检查。
    - 开放英文界面。

### Phase 3: 学术期刊/会议 (Planned)
- **新增能力**：
    - 针对不同期刊 (IEEE, Nature, ACM) 的投稿格式预审。
    - 模拟同行评审 (Peer Review) 意见。
    - 对接 Zotero/EndNote 参考文献格式校验。
    - 接入 Stripe/PayPal 国际支付。
    - **自动化运维**：引入智能自动退款策略（基于前期人工处理的数据积累）。

---

## 3. 用户角色与权限

| 角色 | 权限描述 |
| :--- | :--- |
| **普通用户 (User)** | - 注册/登录 (Supabase Auth)<br>- 购买/充值点数 (Credits)<br>- 上传论文 (PDF) 并消耗点数<br>- 查看审阅进度 (Gemini 风格)<br>- 下载审阅报告<br>- 历史记录管理 (左侧边栏) |
| **管理员 (Admin)** | - 全局仪表盘 (用户数、营收、任务队列)<br>- 订单管理 (退款、查单)<br>- **异常任务工单处理 (Retry/Refund)**<br>- **后台配置管理 (Prompt Lab, Pricing, System Config)**<br>- 系统日志查看 |

---

## 4. 核心业务流程与交互 (Core Workflow & Interaction)

### 4.1 充值与消耗流程
1.  **购买阶段**：用户在落地页或充值中心选择套餐（1次/10次/50次） -> 支付 -> 账户增加对应 `Credits`。
2.  **上传与扣费阶段**：
    *   用户拖拽 PDF -> 前端解析页码。
    *   后端计算所需消耗点数。
    *   余额充足 -> 扣除点数 -> 进入审阅会话。

### 4.2 AI 审阅交互流程 (The "Agentic" Experience)

**界面布局**：
*   **左侧边栏 (Sidebar)**：历史会话列表。每个会话对应一次论文审阅记录，支持切换、重命名、删除。
*   **右侧主区域 (Workspace)**：

#### Step 1: 对话式引导输入 (Conversational Input)
*   **交互模式**：类似 ChatGPT/Gemini 的对话界面，而非传统表单。
*   **流程**：
    1.  **上传触发**：用户上传 PDF。
    2.  **AI 主动发问**：AI 快速扫描 PDF 首页，然后发起对话。
        > 🤖 AI: "收到论文《基于深度学习的图像识别研究》。看起来这属于【计算机视觉】领域。请问这是**本科**还是**硕士**毕业论文？"
        > *(下方提供 Suggested Chips: [本科论文] [硕士论文])*
    3.  **用户回答**：用户点击选项或直接输入。
        > 👤 User: "硕士论文。"
    4.  **AI 追问关注点**：
        > 🤖 AI: "好的，已按硕士标准配置审阅规则。你有什么特别想让我检查的地方吗？比如**逻辑连贯性**或**参考文献格式**？"
        > *(下方提供 Suggested Chips: [重点查逻辑] [重点查格式] [全部详细查])*
    5.  **用户确认**：
        > 👤 User: "重点帮我看看第三章的数据分析逻辑对不对。"
    6.  **数据提取**：AI 从对话中提取结构化参数（领域、学位类型、Focus Area），传入后端。

#### Step 2: 规划与启动 (Planning & Dispatch)
*   系统根据收集到的信息，生成并展示 **“审阅计划 (Review Plan)”**。
*   **UI 展示**：
    > "正在分析文档结构..."
    > "已识别为【计算机视觉】领域硕士论文..."
    > "正在根据您的要求，配置【逻辑深度分析】策略..."
    > "即将启动以下智能体进行并行审阅："
    > *   🕵️ **格式审查智能体** (Format Agent)
    > *   🧠 **逻辑分析智能体** (Logic Agent) - *High Priority*
    > *   📚 **参考文献核查智能体** (Reference Agent)
*   用户感受到 AI 的“专业性”和“定制化服务”。

#### Step 3: 异步处理与进度展示 (Async Processing)
*   **异步机制**：任务在后端/云端异步运行，不阻塞用户关闭页面。用户再次进入时恢复进度。
*   **进度展示策略**：
    *   **实时流 (Real-time Stream)**：如果某个 Agent 支持流式输出（如逻辑分析），实时打字机效果展示中间思考过程。
    *   **模拟进度 (Simulated Progress)**：对于长时无响应的步骤（如联网检索），使用预设的进度曲线（Optimistic UI），避免界面假死感。
    *   **Agent 状态卡片**：每个 Agent 一个卡片，显示状态（Pending -> Running -> Done）。

#### Step 4: 结果呈现 (Deep Research Style Result)
*   审阅完成后，界面切换为 **分 Tab 结果页**：
    *   **[总览 (Overview)]**：评分、核心问题摘要、修改优先级建议。
    *   **[内容逻辑]**：段落级批注、逻辑漏洞分析。
    *   **[格式规范]**：字体、行距、标题层级错误列表。
    *   **[参考文献]**：引用真实性核查结果、格式错误高亮。
    *   **[语法润色]**：英文摘要修改对比、中文病句标红。
*   **下载区**：支持一键下载汇总 PDF 报告或 Markdown 源码。

---

## 5. 功能模块详解 (Functional Modules)

### 5.1 用户认证模块 (Authentication)
*   **技术栈**：Supabase Auth。
*   **功能点**：邮箱/密码、OAuth (Google/GitHub)、RLS 数据隔离。

### 5.2 计费与套餐模块 (Billing & Credits)
*   **核心逻辑**：预付费点数 (Credits) 模式。
*   **套餐设计**：Single Pass (1次), Standard Bundle (10次), Pro Bundle (50次)。
*   **消耗规则**：<60页=1点, 60-100页=2点, 100-150页=3点。

### 5.3 AI 审阅引擎架构 (Agent Architecture)
*   **多智能体协作 (Multi-Agent System)**：
    *   **Coordinator Agent**: 负责解析用户请求，生成 Plan，分发任务给 Sub-agents。
    *   **Format Agent**: 专注 PDF 解析与 GB/T 标准比对。
    *   **Logic Agent**: 专注长文本理解与逻辑链分析。
    *   **Reference Agent**: 专注引用格式与（可选的）联网真实性校验。
*   **策略模式**：不同论文类型加载不同的 Agent 组合与 Prompt。

### 5.4 报告与下载模块
*   **交互**：Tab 页切换，Deep Research 风格的高密度信息展示。
*   **下载**：PDF (渲染版) + Markdown (源码)。

### 5.5 多语言架构 (Internationalization)
*   **前端**：`next-intl`，所有 UI 文本配置化。
*   **后端**：Prompt 模板支持多语言 Key。

### 5.6 后台管理与配置模块 (Admin & Configuration Module)
*   **架构策略**：基于 **Supabase Storage** + **Next.js Revalidation** 实现配置热更新，无 Redis 依赖。
*   **Prompt 实验室 (Prompt Lab)**：
    *   **Prompt Registry**：管理 Prompt 模板版本（e.g., `logic_check_v2`），支持变量注入 (`{{field}}`, `{{degree}}`)。
    *   **Playground**：在线输入测试文本，实时调用不同模型 (Gemini Pro/Flash) 验证 Prompt 效果。
    *   **发布机制**：点击 Publish -> 更新 Supabase -> 触发 `revalidateTag('llm-prompts')` -> 全局生效。
*   **动态计费与策略 (Dynamic Pricing)**：
    *   JSON 配置化管理套餐价格与消耗规则（e.g., `{"base_price": 9.9, "credits": 10}`）。
    *   支持配置“促销活动”或“新用户优惠”策略。
*   **系统熔断与公告 (Circuit Breaker)**：
    *   **Feature Flags**：一键开启/关闭特定 Agent（如遇 API 故障）。
    *   **Maintenance Mode**：开启全站维护模式，前端展示公告条。

---

## 6. 详细审阅能力标准 (Review Criteria - MVP Focus)

### 6.1 中文毕业论文专属标准
1.  **结构完整性 (Completeness)**：
    *   必须包含：摘要 (中英)、目录、正文 (绪论/引言 -> 结论)、参考文献、致谢。
    *   缺项检查：AI 扫描全文结构，缺失关键章节直接告警。
2.  **内容逻辑 (Logic & Content)**：
    *   **摘要**：四要素检查 (目的、方法、结果、结论)。
    *   **正文**：
        *   前后呼应：结论部分是否回答了绪论中提出的问题。
        *   论证逻辑：段落核心句提取与逻辑链分析。
3.  **格式规范 (Format - GB/T)**：
    *   **标题层级**：检查 1.1, 1.1.1 序号是否连续、规范。
    *   **图表索引**：检查“如图X所示”与实际图表标题是否一致。
    *   **页码检查**：目录页码与实际内容是否对应（大致估算）。
4.  **语法与润色 (Language)**：
    *   **中文**：错别字、病句、口语化表达检查。
    *   **英文摘要 (重点)**：
        *   去除 "Chinglish"。
        *   学术词汇替换 (e.g., use -> utilize, big -> significant)。
5.  **参考文献 (References)**：
    *   **真实性**：联网/数据库检索，标记无法验证的文献。
    *   **格式**：严格匹配 GB/T 7714-2015 标准。
    *   **对应性**：正文引用 [1] 与参考文献列表是否一一对应。

---

## 7. 技术约束与非功能需求
1.  **性能**：PDF 解析 < 10s；完整审阅 < 5分钟 (100页以内)。
2.  **安全**：文件加密存储；支付回调签名校验。
3.  **扩展性**：API 设计遵循 RESTful/GraphQL；支付和审阅逻辑解耦。
4.  **配置热更新**：利用 Next.js ISR/Tag Revalidation 机制实现配置秒级生效，避免引入 Redis 增加运维成本。

### 7.1 前端体验与主题 (UI/UX & Theming)
*   **主题模式**：
    *   **Light Mode (默认)**：清爽、学术风、高对比度。
    *   **Dark Mode**：Gemini/IDE 风格，深色背景 (`#1e1e1e`)，适合夜间长时间阅读。
    *   **System Sync**：自动跟随操作系统设置切换。
*   **实现要求**：
    *   使用 `next-themes` 实现无闪烁切换 (No FOUC)。
    *   组件库 (shadcn/ui) 必须配置完整的 Dark Mode 变量映射。

---

## 8. 异常处理与系统可靠性 (Reliability & Logging)

### 8.1 异常挂起与工单系统 (Suspend & Ticket System - MVP Strategy)
*   **策略说明**：MVP 阶段为保证服务质量和避免误退款，采用**“先人工后自动”**的保守策略。
*   **工单触发机制 (Trigger Mechanism)**：
    1.  **系统自动触发 (System Auto-Trigger)**：
        *   **场景**: 审阅任务重试 3 次后仍失败 (Status: `FAILED` -> `NEEDS_MANUAL_REVIEW`)。
        *   **动作**: 后端自动创建一张 **高优先级 (High Priority)** 工单，关联该任务 ID。
        *   **通知**: 通过邮件/Slack 实时通知管理员 "Review Task #123 Failed"。
    2.  **用户手动触发 (User Manual Trigger)**：
        *   **场景**: 用户对审阅结果不满意或遇到计费问题。
        *   **动作**: 用户在前端点击 "反馈/申诉"，创建一张 **普通优先级** 工单。
*   **处理流程 (Resolution Workflow)**：
    1.  **用户安抚 (User Feedback)**：
        *   前端 UI 显示：“AI 遇到复杂内容，已自动转交专家人工复核，预计 2 小时内完成。”
        *   **禁止直接报错**：通过话术将“技术故障”转化为“增值服务”，降低用户焦虑。
    2.  **管理员介入 (Admin Action)**：
        *   管理员查看 `llm_traces` 日志定位原因。
        *   **Action A (Retry)**: 修复 Prompt 或参数后，点击后台 **[强制重试]** 按钮 -> 工单标记为 `RESOLVED`。
        *   **Action B (Refund)**: 确认为不可处理文件（如加密 PDF），点击 **[拒绝并退款]** -> 系统自动触发退款流程 (Credits Return) -> 工单标记为 `RESOLVED` 并通知用户。

### 8.2 全链路日志审计 (Logging & Audit)
*   **资金流水日志 (`credit_transactions`)**：
    *   **必须记录**：`user_id`, `amount` (+/-), `balance_before`, `balance_after`, `event_type` (充值/消费/退款), `reference_id` (任务ID/订单ID)。
    *   **特性**：不可物理删除，仅允许追加 (Append-only)。
*   **行为审计日志 (`activity_logs`)**：
    *   记录用户关键操作：上传文件、点击审阅、下载报告。
    *   包含元数据：IP 地址、User-Agent、时间戳。
*   **LLM 调试日志 (`llm_traces`)** (仅管理员可见)：
    *   记录每次 LLM 调用的 Input Prompt 和 Output Response。
    *   **隐私脱敏**：自动过滤 PII (个人敏感信息) 后存储。
    *   **用途**：用于后续分析 Bad Case，优化 Prompt 策略。
