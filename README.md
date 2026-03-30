# AI 辅助论文智能审批系统

<div align="center">

**基于多智能体协作的中文学术论文审阅 SaaS 平台**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![Trigger.dev](https://img.shields.io/badge/Trigger.dev-Background_Jobs-orange?style=flat-square)](https://trigger.dev/)

[功能特性](#-核心功能) · [快速开始](#-快速开始) · [架构设计](#-技术架构) · [文档](#-文档)

</div>

---

## 项目简介

这是一个**自动化、智能化、高并发**的论文审阅平台。**MVP 阶段**专注于为中文高校毕业生提供"导师级"的论文预审服务，通过多智能体并行协作实现深度、高效的论文审阅。

### 核心价值

- **深度审阅**：针对毕业论文的特殊性（结构完整性、格式规范、致谢、引用），提供全方位检查
- **可视化思考**：多智能体协作进度实时展示，让用户看到 AI "阅读"和"思考"的过程
- **全球化架构**：底层代码完全支持多语言切换，为后续扩展英文学位论文、期刊论文做好充分准备

---

## 核心功能

### 智能 AI 审阅引擎

| 智能体 | 功能描述 |
| :--- | :--- |
| **格式审查智能体** | 检查 GB/T 标准格式（标题层级、字体、行距、图表索引） |
| **逻辑分析智能体** | 深度理解论文内容，分析逻辑链完整性与论证连贯性 |
| **参考文献核查智能体** | GB/T 7714-2015 格式校验、引用对应性检查、真实性核查 |

### 审阅能力（中文毕业论文专属）

- **结构完整性检查**：摘要（中英）、目录、正文、参考文献、致谢缺项告警
- **内容逻辑分析**：摘要四要素检查、前后呼应分析、论证逻辑链分析
- **格式规范检查**：标题层级、图表索引、页码对应性
- **语法与润色**：中文病句检查、英文摘要去 Chinglish、学术词汇替换
- **参考文献核查**：格式匹配 GB/T 7714-2015、正文引用对应性、真实性联网检索

### 用户功能

- **对话式引导输入**：类似 ChatGPT/Gemini 的交互体验，通过对话收集审阅参数
- **异步会话管理**：支持历史会话切换、重命名、删除
- **多智能体可视化**：实时展示各 Agent 工作状态（Pending → Running → Done）
- **分 Tab 结果展示**：总览 / 内容逻辑 / 格式规范 / 参考文献 / 语法润色
- **多格式报告导出**：PDF 渲染版 + Markdown 源码

### 管理功能

- **Prompt 实验室**：在线管理 Prompt 模板、版本控制、A/B 测试
- **动态计费策略**：套餐价格与消耗规则配置化、促销活动管理
- **异常工单系统**：任务失败自动创建工单、支持人工重试/退款
- **全链路日志审计**：资金流水、用户行为、LLM 调用追踪

---

## 技术架构

### 技术栈

| 层级 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | Next.js 16.1 | App Router + Server Components |
| **UI 组件** | React 19 + shadcn/ui | 基于 Radix UI 的无障碍组件 |
| **样式方案** | Tailwind CSS 4 | 原子化 CSS + Dark Mode 支持 |
| **多语言** | next-intl | 类型安全的 i18n 方案 |
| **身份认证** | Supabase Auth | 邮箱/密码 + OAuth + RLS |
| **数据库** | Supabase PostgreSQL | JSONB 存储并行任务状态 |
| **文件存储** | Supabase Storage | PDF 加密存储 |
| **实时通信** | Supabase Realtime | WebSocket 进度推送 |
| **后台任务** | Trigger.dev v3 | 长运行 AI 任务卸载 |
| **LLM 服务** | OpenRouter API | 统一接入多家模型提供商 |
| **支付集成** | Zpay | 点数套餐预付费模式 |
| **类型验证** | Zod v4 | 端到端类型安全 |

### 架构亮点

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js (Vercel)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Frontend  │  │  API Routes │  │  Trigger.dev Client │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │ PostgreSQL  │  │   Storage   │  │     Realtime        │    │
│  │  (Reviews)  │  │  (PDFs)     │  │  (Progress Push)    │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Trigger.dev Cloud                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Review Job                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Format Agent│  │ Logic Agent │  │ Ref Agent   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │         │                 │                 │             │   │
│  │         └─────────────────┴─────────────────┘             │   │
│  │                           │                               │   │
│  │                    OpenRouter API                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **Serverless Parallelism**：通过 Trigger.dev 将 AI 任务卸载到无服务器后台，突破 Vercel 300s 超时限制
2. **Fan-out/Fan-in 模式**：使用 `Promise.all` 让多个 Agent 并行工作，显著缩短用户等待时间
3. **配置热更新**：基于 Supabase Storage + Next.js Revalidation 实现配置秒级生效，无需 Redis
4. **国际化先行**：Day 1 即引入 i18n，为快速扩展至英文论文做好充分准备

---

## 快速开始

### 环境要求

- Node.js 20+
- **包管理器：pnpm**（与 Vercel 一致）。启用 Corepack 后使用仓库锁定的版本：`corepack enable && corepack prepare pnpm@10.14.0 --activate`

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

创建 `.env.local` 文件：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Trigger.dev
TRIGGER_DEV_API_KEY=your_trigger_api_key

# OpenRouter (LLM)
OPENROUTER_API_KEY=your_openrouter_key
# 可选：OpenRouter 统计（HTTP-Referer / X-Title）；未设 OPENROUTER_HTTP_REFERER 时可复用 NEXT_PUBLIC_APP_URL
# OPENROUTER_HTTP_REFERER=https://your-site.example
# OPENROUTER_APP_TITLE=your_app_name

# Zpay (Payment)
ZPAY_MERCHANT_ID=your_merchant_id
ZPAY_SECRET_KEY=your_secret_key

# Next Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

### 运行开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

---

## 项目结构

```
thesis-anno-public/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # 国际化路由
│   │   ├── (auth)/               # 认证相关页面
│   │   ├── dashboard/            # 用户中心
│   │   └── page.tsx              # 首页
│   ├── components/               # 共享组件
│   │   ├── landing/              # 落地页组件
│   │   ├── billing/              # 计费组件
│   │   └── profile/              # 用户资料组件
│   └── lib/                      # 工具库
├── docs/                         # 项目文档
│   ├── AI_Thesis_Review_PRD_v2.0.md
│   ├── AI_Thesis_Review_Architecture_Design.md
│   └── ...
├── public/                       # 静态资源
├── supabase/                     # Supabase 配置
│   ├── migrations/               # 数据库迁移
│   └── functions/                # Edge Functions
└── src/                          # 源代码
    ├── trigger/                  # Trigger.dev Jobs
    │   └── review.ts             # 论文审阅任务
    └── lib/
        ├── agents/               # AI Agent 实现
        │   ├── format.ts
        │   ├── logic.ts
        │   └── reference.ts
        └── supabase.ts           # Supabase 客户端
```

---

## 文档

| 文档 | 描述 |
| :--- | :--- |
| [PRD v2.0](docs/AI_Thesis_Review_PRD_v2.0.md) | 产品需求文档 |
| [架构设计](docs/AI_Thesis_Review_Architecture_Design.md) | 系统架构设计 |
| [数据库 Schema](docs/AI_Thesis_Review_Database_Schema_v2.0.md) | 数据库结构 |
| [安全审计报告](docs/Security_Audit_Report_v1.0.md) | 安全审计结果 |

---

## 迭代路线图

### Phase 1: MVP（当前版本）

- ✅ 中文毕业论文全流程审阅
- ✅ 点数计费系统 + Zpay 支付
- ✅ Gemini Deep Research 风格交互
- ✅ 完整 i18n 基础设施（仅开放中文）

### Phase 2: 英文学位论文（计划中）

- 英文学位论文格式库（APA, MLA, Harvard）
- Grammarly 级别的学术语法检查
- 开放英文界面

### Phase 3: 学术期刊/会议（未来规划）

- 针对不同期刊（IEEE, Nature, ACM）的投稿格式预审
- 模拟同行评审（Peer Review）意见
- Zotero/EndNote 参考文献格式校验
- Stripe/PayPal 国际支付

---

## 许可证

[MIT License](LICENSE)

---

## 联系方式

如有问题或建议，请提交 [Issue](https://github.com/your-repo/issues) 或 Pull Request。

<div align="center">

**Made with ❤️ by Thesis Anno Team**

</div>
