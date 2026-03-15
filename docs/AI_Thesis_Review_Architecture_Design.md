# AI 辅助论文审批系统架构设计 (V2.0 - Serverless Trigger.dev)

| 版本号 | 修订日期 | 修改描述 | 作者 |
| :--- | :--- | :--- | :--- |
| V2.1 | 2026-03-15 | 优化审阅流程为**并行解耦架构 (Parallel Agents)**，使用 `Promise.all` 管理子任务 | Colin |
| V2.0 | 2026-03-15 | 重构为 Serverless 架构：Next.js + Trigger.dev + Supabase Realtime | Colin |
| V1.0 | 2026-03-15 | (Deprecated) 基于 Aliyun Worker 的异步架构 | Colin |

---

## 1. 架构核心思想：Serverless Parallelism

本架构旨在解决 Vercel 300s 超时限制，同时避免维护传统服务器 (VPS)。通过 **Trigger.dev (v3)** 将耗时的 AI 任务卸载到云端后台执行，并采用 **并行分发 (Fan-out)** 模式让多个 Agent 同时工作，显著缩短用户等待时间。

### 1.1 核心组件选择
1.  **Frontend & API (Vercel)**: Next.js 全栈框架，负责 UI、文件上传、触发任务。
2.  **Background Jobs (Trigger.dev Cloud)**: 
    *   **运行环境**: 独立的长运行容器环境（非 Vercel Serverless）。
    *   **职责**: 执行 PDF 解析、LLM 调用、逻辑分析等耗时任务。
    *   **特性**: 无 300s 限制、自带并发控制队列、自动重试。
3.  **Database & Storage (Supabase)**:
    *   **PostgreSQL**: 存储任务状态 (`reviews` 表)，特别是 `stages` JSON 字段用于并行状态管理。
    *   **Storage**: 存储 PDF 文件。
    *   **Realtime**: 监听数据库变更，向前端推送进度。
4.  **LLM Provider (OpenRouter)**:
    *   直接通过 HTTP/SDK 调用，不依赖 Vercel AI SDK。

---

## 2. 系统架构图 (Parallel Execution)

```mermaid
graph TD
    User((用户 User))
    
    subgraph "Vercel (Next.js App)"
        UI[Frontend UI]
        API[API Route /api/reviews]
    end
    
    subgraph "Supabase (BaaS)"
        DB[(PostgreSQL)]
        Storage[File Storage]
        Realtime[Realtime Service]
    end
    
    subgraph "Trigger.dev Cloud (Background Jobs)"
        TriggerClient[Trigger.dev Client]
        Job[Review Job (review.ts)]
        Agent1[Format Agent Task]
        Agent2[Logic Agent Task]
        Agent3[Reference Agent Task]
    end

    subgraph "External Services"
        OpenRouter[OpenRouter API]
    end

    %% Upload & Trigger Flow
    User -->|1. 上传 PDF| UI
    UI -->|2. 存储文件| Storage
    UI -->|3. 创建任务记录| DB
    UI -->|4. 触发任务| TriggerClient
    TriggerClient -->|5. 调度任务| Job

    %% Parallel Execution Flow
    Job -->|6. 下载 & 解析 PDF| Storage
    Job -->|7. 并行启动 (Promise.all)| Agent1 & Agent2 & Agent3
    
    Agent1 -->|8a. 格式检查| OpenRouter
    Agent2 -->|8b. 逻辑分析| OpenRouter
    Agent3 -->|8c. 文献核查| OpenRouter
    
    %% State Updates & Realtime
    Agent1 & Agent2 & Agent3 -->|9. 独立更新 stages 状态| DB
    DB -.->|10. Postgres Changes (WebSocket)| Realtime
    Realtime -.->|11. 实时推送状态| UI
    
    %% Completion
    Job -->|12. 聚合结果 & 完成| DB
```

---

## 3. 详细数据流 (Data Flow)

### Step 1: 提交任务 (Frontend)
1.  用户在前端上传 PDF。
2.  前端直接上传文件到 **Supabase Storage** bucket `thesis-files`。
3.  前端调用 Supabase SDK 在 `reviews` 表插入一条记录，初始化 `stages`：
    ```json
    {
      "user_id": "user_123",
      "status": "pending",
      "stages": [
        { "id": "format", "name": "格式规范检查", "status": "pending" },
        { "id": "logic", "name": "逻辑深度分析", "status": "pending" },
        { "id": "reference", "name": "参考文献核查", "status": "pending" }
      ]
    }
    ```
4.  前端调用 Trigger.dev SDK 触发任务。
5.  前端立即跳转到详情页。

### Step 2: 后台并行处理 (Trigger.dev)
1.  **Job 启动**：Trigger.dev 接收事件，开始执行。
2.  **准备工作**：
    *   更新 DB: `status='processing'`。
    *   下载 PDF 并解析为文本。
3.  **并行分发 (Fan-out)**：
    *   使用 `Promise.all` 同时启动 3 个异步函数：`checkFormat`, `checkLogic`, `checkReference`。
    *   **每个函数内部**：
        1.  更新对应 Stage 状态为 `processing`。
        2.  调用 LLM (OpenRouter)。
        3.  更新对应 Stage 状态为 `completed` 并写入局部结果。
        4.  更新 DB。
4.  **结果聚合 (Fan-in)**：
    *   等待所有 Promise 完成。
    *   整合所有结果为最终 JSON。
    *   更新 DB: `status='completed'`, `progress=100`。

### Step 3: 实时反馈 (Realtime)
1.  前端订阅 `reviews:id=eq.review_123`。
2.  每当任意一个 Agent 更新它的 Stage 状态，DB 都会触发推送。
3.  前端 UI 渲染一个任务列表，用户能看到三个圆圈同时在转，然后陆续变绿。

---

## 4. 数据库设计 (Schema)

核心表：`public.reviews`

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | `uuid` | 主键 |
| `user_id` | `uuid` | 关联 `auth.users` |
| `status` | `text` | `pending`, `processing`, `completed`, `failed` |
| `file_url` | `text` | Supabase Storage 路径 |
| `stages` | `jsonb` | **核心状态字段**，存储并行任务的详细进度 |
| `result` | `jsonb` | 最终的结构化审阅报告 |
| `error` | `text` | 错误信息 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间 |

**`stages` JSON 结构详解：**
```json
[
  { 
    "id": "format", 
    "name": "格式规范检查", 
    "status": "completed", 
    "details": "发现 3 处标题层级错误" 
  },
  { 
    "id": "logic", 
    "name": "逻辑深度分析", 
    "status": "processing",
    "details": "正在分析第三章论证..." 
  },
  { 
    "id": "reference", 
    "name": "参考文献核查", 
    "status": "pending" 
  }
]
```

---

## 5. 代码结构规划

### 5.1 Trigger.dev Job 示例 (`/src/trigger/review.ts`)

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { supabase } from "@/lib/supabase";
import { checkFormat, checkLogic, checkReference } from "@/lib/agents";

export const reviewThesis = task({
  id: "review-thesis",
  run: async (payload: { reviewId: string; fileUrl: string }) => {
    const { reviewId, fileUrl } = payload;

    // 1. 初始化状态
    await updateReviewStatus(reviewId, "processing");
    
    try {
      // 2. 下载与解析 (这是串行的，因为所有 Agent 都需要文本)
      const text = await downloadAndParse(fileUrl);
      
      // 3. 并行执行 (Parallel Execution)
      // 使用 Promise.allSettled 确保即使一个失败，其他也能完成
      const results = await Promise.allSettled([
        runAgent("format", text, reviewId, checkFormat),
        runAgent("logic", text, reviewId, checkLogic),
        runAgent("reference", text, reviewId, checkReference)
      ]);

      // 4. 结果聚合
      const finalResult = {
        format: results[0].status === 'fulfilled' ? results[0].value : null,
        logic: results[1].status === 'fulfilled' ? results[1].value : null,
        reference: results[2].status === 'fulfilled' ? results[2].value : null,
      };

      // 5. 完成
      await supabase.from("reviews").update({
        status: "completed",
        result: finalResult
      }).eq("id", reviewId);

    } catch (error) {
      await updateReviewStatus(reviewId, "failed", error.message);
    }
  },
});

// 辅助函数：封装单个 Agent 的执行与状态更新
async function runAgent(stageId, text, reviewId, agentFn) {
  // A. 标记开始
  await updateStageStatus(reviewId, stageId, "processing");
  
  try {
    // B. 执行 LLM 逻辑
    const result = await agentFn(text);
    
    // C. 标记完成
    await updateStageStatus(reviewId, stageId, "completed", "完成");
    return result;
  } catch (e) {
    // D. 标记失败
    await updateStageStatus(reviewId, stageId, "failed", e.message);
    throw e;
  }
}
```

---

## 6. 关键配置说明

### 6.1 并发控制 (Concurrency)
在 `trigger.config.ts` 或 Job 定义中设置：
```typescript
export const reviewThesis = task({
  id: "review-thesis",
  queue: {
    concurrencyLimit: 5 // 全局同时只处理 5 个任务
  },
  // ...
});
```

### 6.2 超时与重试
*   Trigger.dev 默认无严格超时限制（可跑数小时）。
*   LLM 调用建议设置 `retry` 策略，应对网络抖动。

### 6.3 环境变量
需要在 Trigger.dev Dashboard 配置：
*   `SUPABASE_URL`
*   `SUPABASE_SERVICE_ROLE_KEY` (用于后台写入数据库，绕过 RLS)
*   `OPENROUTER_API_KEY`
