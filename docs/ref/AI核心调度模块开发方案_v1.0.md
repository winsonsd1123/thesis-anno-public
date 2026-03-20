# AI核心调度模块开发方案 v1.0

## 1. 模块概述 (Overview)

本模块对应 PRD **4.3 AI 核心调度模块**，负责协调大语言模型 (LLM) 和外部验证工具，实现对论文的**内容审查 (Action A)** 和 **参考文献真实性校验 (Action B)**。

### 1.1 核心设计理念
*   **高度解耦**: 采用策略模式 (Strategy Pattern)，调度器与具体 Agent 实现分离，易于未来扩展更多审查维度。
*   **并行加速**: 两个 Agent 并行执行，大幅缩短总耗时。
*   **即时反馈**: 通过 Server-Sent Events (SSE) 实时推送各步骤状态，提供动态的进度展示体验。
*   **动态配置**: 支持管理员动态修改 Prompt，无需发版。
*   **多模态输入**: 直接利用 LLM 的多模态能力 (通过 OpenRouter 调用 google/gemini-3.1-pro-preview) 处理 PDF 文件，避免纯文本解析带来的信息丢失。

## 2. 系统架构设计 (Architecture)

### 2.1 业务流程图
```mermaid
graph TD
    User(教师点击AI审阅) -->|Open Modal| FE[前端 AiReviewDialog]
    FE -->|SSE Connect| API[GET /api/ai-review/stream]
    
    API -->|Start| Orch[ReviewOrchestrator]
    Orch -->|Parallel Call| AgentA[ContentReviewAgent]
    Orch -->|Parallel Call| AgentB[ReferenceCheckAgent]
    
    AgentA -->|Get Prompt| DB[(system_prompts)]
    AgentA -->|Send PDF Buffer| OpenRouter[OpenRouter: Gemini 3.1 Pro]
    AgentA -.->|Step Update| SSE_Stream
    
    AgentB -->|Get Prompt| DB
    AgentB -->|Extract Refs (PDF Buffer)| OpenRouter
    AgentB -->|Verify Refs| MockAPI[Mock Validator]
    AgentB -.->|Step Update| SSE_Stream
    
    AgentA & AgentB -->|Return Result| Orch
    Orch -->|Merge & Send| FE
    
    FE -->|Render| UI[暂存区展示]
    UI -->|User Review| Final[人工确认保存]
```

### 2.2 核心组件
1.  **Orchestrator (调度器)**:
    *   位于 `src/services/ai-review/orchestrator.ts`。
    *   职责：初始化任务、并行调度 Agent、聚合结果、通过 SSE 推送状态。
2.  **Agents (执行单元)**:
    *   `ContentReviewAgent`: 负责正文逻辑、格式审查。直接输入 PDF Buffer 给 LLM。
    *   `ReferenceCheckAgent`: 负责参考文献提取与真伪校验。先让 LLM 提取 JSON，再 Mock 校验。
    *   **LLM Provider**: 统一通过 OpenRouter 调用 `google/gemini-3.1-pro-preview` 模型。
3.  **PromptManager**:
    *   负责从数据库读取 Prompt，支持内存缓存。

## 3. 智能体详细设计 (Agent Design)

### 3.1 ContentReviewAgent (Action A)
*   **目标**: 审查论文正文的逻辑、格式、错别字及内容质量。
*   **输入**: PDF 文件 Buffer (Base64 编码) + Prompt。
*   **模型**: OpenRouter: `google/gemini-3.1-pro-preview`。
*   **Prompt (System)**:
    ```markdown
    你是一位**极其严苛**的资深学术论文评审专家。请阅读上传的 PDF 文件，对全文进行**逐章、逐段**的深度审查。你的目标是尽可能多地发现论文中的逻辑漏洞、格式错误、错别字以及内容质量问题，**绝不放过任何细节**。

    **核心指令 (Critical Instructions):**
    1.  **禁止敷衍**: 不要只返回几个笼统的意见。必须覆盖全文所有章节（摘要、引言、方法、实验、结论等）。
    2.  **逐章审查**: 请按照论文结构依次进行审查，确保每个主要章节都有对应的评审意见。
    3.  **数量要求**: 尽最大可能找出所有潜在问题。如果论文质量一般，你应该能找出至少 20+以上个具体改进点。
    4.  **客观犀利**: 指出问题时要一针见血，不要使用模棱两可的客套话。

    **重点关注维度**:
    1.  **摘要与结论的一致性**: 检查摘要是否准确反映了文章的核心贡献，结论是否过度夸大。
    2.  **章节逻辑连贯性**: 段落之间、章节之间是否有逻辑断层，推导过程是否严密。
    3.  **引用格式规范**: 检查文中引用标注是否符合学术规范 (如 [1] 或 (Author, Year))，是否存在未引用的声明。
    4.  **图表清晰度与说明**: 检查图表是否清晰，坐标轴标签是否完整，是否有对应的文字说明。
    5.  **语言表达**: 检查是否存在中式英语 (Chinglish)、语法错误或用词不当。
    6.  **内容正确**: 检查论文内容是否合理正确，是否和该领域的理论知识不一致。

    输出格式要求 (JSON Array Only):
    必须且只能返回一个 JSON 数组，不要包含 Markdown 标记。每个对象包含：
    - `chapter`: 问题所在的章节（如 "1. 引言" 或 "3.2 实验结果"）。
    - `page`: 具体的页码（整型数字，int类型）。
    - `quote_text`: 问题对应的原文片段（保留 20-50 字以便定位）。
    - `issue_type`: 问题类型，必须是以下之一：`format` (格式), `logic` (逻辑), `typo` (错别字), `content` (内容质量)。
    - `suggestion`: 具体的修改建议或评审意见，语气要客观、专业。
    ```

### 3.2 ReferenceCheckAgent (Action B)
*   **目标**: 提取参考文献并校验真实性。
*   **输入**: PDF 文件 Buffer (Base64 编码) + Prompt。
*   **流程**:
    1.  **Step 1: 提取 (Extraction)**: 调用 LLM 提取文献列表。
    2.  **Step 2: 校验 (Verification)**: 遍历提取结果，调用 Mock 接口校验。
*   **Prompt (System - Step 1)**:
    ```markdown
    请从上传的 PDF 文件中，识别并提取所有参考文献 (References / Bibliography)。

    输出格式要求 (JSON Array Only):
    必须且只能返回一个 JSON 数组，不要包含 Markdown 标记。每个对象包含：
    - `id`: 文献序号 (如 "1", "[1]")。
    - `text`: 文献完整条目文本。
    - `title`: 文献标题 (如果能识别)。
    - `author`: 第一作者 (如果能识别)。
    ```
*   **校验逻辑 (Step 2 - Mock)**:
    *   随机产生校验结果：
        *   80% 概率为 `valid`。
        *   20% 概率为 `invalid` (提示“无法检索到该文献”或“引用格式错误”)。

## 4. 数据库设计 (Database Schema)

### 4.1 Prompt 配置表 (`system_prompts`)
用于满足 PRD 4.4 管理员动态修改 Prompt 的需求。

```sql
CREATE TABLE public.system_prompts (
  key TEXT PRIMARY KEY,           -- 唯一标识 (e.g., 'content_review_v1')
  content TEXT NOT NULL,          -- Prompt 模板内容
  description TEXT,               -- 用途说明
  is_active BOOLEAN DEFAULT TRUE, -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化数据
INSERT INTO system_prompts (key, content, description) VALUES 
('content_review_v1', 'You are a thesis review expert...', '正文内容审查 Prompt'),
('reference_extract_v1', 'Extract all references...', '参考文献提取 Prompt');
```

## 5. API 接口设计

### 5.1 AI 审阅流式接口
*   **Endpoint**: `GET /api/versions/:versionId/ai-review/stream`
*   **Method**: `GET` (SSE Standard)
*   **Response Events**:
    *   `event: status`: 推送步骤更新。
        ```json
        {
          "step": "parsing_pdf" | "context_building" | "requesting_llm" | "verifying",
          "agent": "content" | "reference",
          "status": "processing" | "done"
        }
        ```
    *   `event: result`: 推送最终结果（一次性合并返回）。
        ```json
        {
          "data": [
            { "source": "ai_content", "content": "...", "issue_type": "logic" },
            { "source": "ai_reference", "content": "...", "issue_type": "citation" }
          ]
        }
        ```
    *   `event: done`: 结束信号。

## 6. 前端交互设计 (UX)

### 6.1 悬浮层进度展示 (`AiReviewDialog`)
点击“AI 智能审阅”后，弹出一个模态框，包含两个独立的进度区域：

*   **区域 A: 内容与格式审查**
    *   [ ] 解析 PDF (转 Base64)
    *   [ ] 构建审查 Context (Prompt)
    *   [ ] AI 智能分析中 (Gemini Multimodal)
    *   [ ] 结果生成完毕
*   **区域 B: 参考文献校验**
    *   [ ] 提取引用列表 (Gemini Extraction)
    *   [ ] 外部数据库比对 (Mock Validator)
    *   [ ] 校验完成

### 6.2 结果处理
*   **暂存机制**: AI 返回的结果**不直接入库**，而是暂存在前端 `pendingChanges.added` 状态中。
*   **人工确认**: 教师在右侧面板查看、修改、删除 AI 意见。
*   **最终保存**: 仅在教师点击“返回选题”、“退回修改”或“审批通过”时，调用现有 API 统一保存。

## 7. 开发计划

1.  **Database**: 创建 `system_prompts` 表及初始数据。
2.  **Backend**:
    *   实现 `PromptManager` (含缓存)。
    *   实现 `ContentReviewAgent` (集成 Google Gemini Multimodal)。
    *   实现 `ReferenceCheckAgent` (Mock 数据)。
    *   实现 `ReviewOrchestrator` 及 SSE 路由。
3.  **Frontend**:
    *   开发 `AiReviewDialog` 组件，实现 SSE 监听与 UI 状态映射。
    *   集成到 `WorkspacePage`，对接结果暂存逻辑。
