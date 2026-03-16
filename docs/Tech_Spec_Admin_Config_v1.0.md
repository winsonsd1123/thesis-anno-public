# 后台管理与配置模块技术方案 (Tech Spec) v1.0

| 版本 | 日期 | 作者 | 状态 |
| :--- | :--- | :--- | :--- |
| v1.0 | 2026-03-16 | Colin | Draft |  

---

## 1. 概述 (Overview)

本设计方案旨在落实 PRD V2.0 中 **5.6 后台管理与配置模块** 及 **5.5 多语言架构** 的技术实现。核心目标是构建一个**去中心化、无需 Redis、支持热更新**的配置管理系统，特别是针对 LLM Prompt 的精细化管理和国际化支持。

### 核心目标
1.  **配置热更新 (Hot Reload)**：利用 Next.js ISR/Tag Revalidation 机制，实现配置修改后秒级生效，无需重新部署。
2.  **Prompt 实验室 (Prompt Lab)**：将 Prompt 从代码中解耦，支持版本管理、变量注入和在线测试。
3.  **国际化深度集成 (Deep i18n)**：不仅 UI 支持多语言，核心 Prompt 逻辑也必须根据用户语言偏好自动适配。
4.  **系统熔断与降级 (Circuit Breaker)**：提供全局开关，应对 API 故障或维护需求。

---

## 2. 架构设计 (Architecture)

采用 **"Storage-First + Cache-Aside"** 策略，利用 Supabase Storage 作为持久化存储，Next.js Data Cache 作为高性能读取层。

### 2.1 数据流向
1.  **读取链路**: App -> `ConfigService` -> Next.js Cache (Memory/Disk) -> (Miss) -> Supabase Storage -> Return Config.
2.  **写入链路**: Admin Panel -> `ConfigService` -> Supabase Storage -> `revalidateTag()` -> Cache Purged.

### 2.2 核心组件
*   **Supabase Storage Bucket**: `app-config` (Private Bucket)
    *   `prompts.json`: 存储所有 Prompt 模板及其多语言版本。
    *   `billing.json`: 存储计费规则和套餐价格。
    *   `system.json`: 存储系统开关、维护模式状态。
*   **ConfigService**: 单例服务，负责配置的 Fetch, Cache, Validate (Zod), Update。
*   **PromptManager**: 负责 Prompt 的解析、变量填充和语言选择。

---

## 3. 详细设计 (Detailed Design)

### 3.1 Prompt 管理与国际化方案 (Prompt Management & i18n)

针对用户提到的 "Prompt 多语言" 需求，我们不简单的将 Prompt 视为普通的翻译 Key，而是将其视为**结构化的多语言模板**。

#### 3.1.1 数据结构 (JSON Schema)

文件路径: `app-config/prompts.json`

```json
{
  "logic_analysis_agent": {
    "description": "逻辑分析智能体的主指令",
    "version": "1.0.2",
    "variables": ["paper_type", "focus_area", "content"],
    "templates": {
      "zh": "你是一位资深的{{paper_type}}评审专家。请重点关注{{focus_area}}。以下是论文内容：\n{{content}}\n请从逻辑连贯性角度进行严厉的批判。",
      "en": "You are a senior reviewer for {{paper_type}}. Please focus on {{focus_area}}. Here is the content:\n{{content}}\nCritique strictly from the perspective of logical coherence."
    },
    "model_config": {
      "temperature": 0.3,
      "model": "gemini-1.5-pro"
    }
  },
  "format_check_agent": {
    "description": "格式检查智能体",
    "version": "1.0.0",
    "variables": ["content"],
    "templates": {
      "zh": "请检查以下文本是否符合 GB/T 7714 标准...",
      "en": "Please check if the following text complies with APA style..."
    }
  }
}
```

#### 3.1.2 运行机制
1.  **获取模板**: `PromptManager.getTemplate('logic_analysis_agent')`。
2.  **语言匹配**: 根据当前用户 Session 的 `locale` (from `next-intl`)，自动选择 `templates['zh']` 或 `templates['en']`。
    *   *Fallback 策略*: 如果 `fr` (法语) 不存在，默认回退到 `en`。
3.  **变量注入**: 使用简单的字符串替换或轻量级模板引擎 (如 Mustache) 将 `{{content}}` 替换为实际数据。

### 3.2 配置服务 (ConfigService)

封装所有配置读取逻辑，确保类型安全和缓存有效性。

#### 接口定义

```typescript
// lib/services/config.service.ts

import { z } from "zod";

export class ConfigService {
  // 泛型方法，支持传入 Zod Schema 进行运行时校验
  static async get<T>(key: string, schema: z.ZodSchema<T>): Promise<T> {
    // 1. 尝试从 Next.js Cache 读取 (key 为 cache key)
    // 2. Cache Miss -> 从 Supabase Storage 下载 JSON
    // 3. Zod Parse 校验数据格式 (防止配置错误导致 Crash)
    // 4. 返回数据并缓存 (设置 revalidate tags)
  }

  static async update<T>(key: string, data: T): Promise<void> {
    // 1. 上传 JSON 到 Supabase Storage
    // 2. 调用 revalidateTag(key) 清除缓存
  }
}
```

### 3.3 管理后台 (Admin Dashboard)

路径: `/admin/config` (需 Admin 权限)

#### 功能模块
1.  **Prompt Lab (表单化配置)**：
    *   **列表页**：展示所有 Prompt Key (e.g., `logic_check`)。
    *   **编辑页 (Form)**：
        *   **基础信息**：描述、版本号、模型参数 (Temperature) - 均为独立表单项。
        *   **多语言模板 (Tabs)**：`中文 (zh)` / `English (en)` 切换 Tab。
        *   **内容编辑器**：多行文本框 (Textarea) 输入 Prompt 内容。支持 `{{variable}}` 高亮。
        *   **变量管理**：自动提取内容中的 `{{}}` 变量供确认。
    *   **保存机制**：前端自动将表单内容序列化为 JSON 格式上传，**自动处理转义字符**，用户无需接触 JSON 语法。
    *   *(已移除在线 Playground 测试功能)*
2.  **Pricing Config**:
    *   表单形式编辑套餐价格、点数消耗规则。
3.  **System Status (维护模式)**：
    *   **表现 (UX)**：
        *   当 `maintenance_mode = true` 时，全站（除管理员白名单路径外）展示全屏维护页 (Maintenance Page)。
        *   **内容**：Logo、友好插图、维护公告文案（支持多语言）、预计恢复时间。
        *   **API 响应**：所有非白名单 API 返回 `503 Service Unavailable`。
    *   **管理员豁免机制 (Admin Bypass)**：
        *   **登录入口保障**：`/login` 和 `/api/auth/*` 始终放行，确保管理员可以登录。
        *   **权限判断**：登录后，中间件 (Middleware) 检查用户角色。
            *   若 `role === 'admin'` -> **放行**，进入 Dashboard，顶部显示 "系统维护中" 警告条。
            *   若 `role !== 'admin'` -> **拦截**，重定向至维护页。
        *   **管理后台保障**：`/admin/*` 路径始终在白名单内，确保管理员有关闭维护模式的“钥匙”。

---

## 4. 国际化 (i18n) 适配细节

鉴于前端已使用 `next-intl`，Prompt 的 i18n 将与之保持上下文一致。

1.  **Locale 传递**: 在调用后端 API (Server Actions / Route Handlers) 时，必须从 `next-intl/server` 获取当前 `locale` 并传递给 `PromptManager`。
2.  **Prompt 差异化**:
    *   **中文 (zh)**: 强调语气委婉但切中要害，符合中国学术习惯 (e.g., "建议修改为...")。
    *   **英文 (en)**: 强调直接、客观 (e.g., "The argument is weak because...")。
    *   这证明了**不能简单翻译**，必须维护两套独立的 Prompt 模板。

---

## 5. 开发计划 (Development Plan)

### Phase 1: 基础设施 (Infrastructure)
1.  在 Supabase 创建 Storage Bucket: `app-config`，设置为 Private。
2.  初始化默认配置文件 (`prompts.json`, `billing.json`) 并上传。
3.  实现 `ConfigService` (含 Zod Schema 定义)。

### Phase 2: 业务集成 (Integration)
1.  重构 `BillingService`，从 `ConfigService` 读取计费规则。
2.  实现 `PromptManager`，支持多语言模板渲染。
3.  在 AI 审阅流程中接入 `PromptManager`，替换硬编码的 Prompt。

### Phase 3: 管理后台 (Admin UI)
1.  开发 `/admin/config/prompts` 页面 (Monaco Editor 集成)。
2.  开发 Prompt Playground (调用实际 LLM 接口)。
3.  实现配置保存与 Cache Revalidation 逻辑。

---

## 6. 风险与对策

1.  **JSON 格式风险**: 提示词中的特殊字符可能破坏 JSON 结构。
    *   *对策*: **前端表单化**。用户在 Textarea 输入自然语言，前端通过 `JSON.stringify` 自动转义特殊字符（如换行符、引号），后端直接存储序列化后的字符串，杜绝手动编辑 JSON 带来的语法错误风险。
2.  **缓存一致性**: 多实例部署时可能存在缓存延迟。
    *   *对策*: 依赖 Next.js 的 ISR 机制，通常在 1-2秒内全网生效。对于极其敏感的配置 (如价格)，可设置更短的缓存时间或直接透穿。
