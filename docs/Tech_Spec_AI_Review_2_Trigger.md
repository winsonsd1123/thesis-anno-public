# AI 审阅引擎实施方案 2/3: Trigger 编排与降级策略 (Orchestrator)

## 1. 模块定位与三层架构映射
基于 `@trigger.dev/sdk/v3`，负责在后台节点接收前端发起的审阅请求，下载文件，并发调度底层的 AI 审阅引擎，并将执行进度和结果实时同步到 Supabase 数据库。

在三层架构中，本模块涉及：
*   **展现层/入口 (Server Action)**: `lib/actions/trigger.action.ts` 负责接收用户指令并触发 Trigger Job。
*   **调度层 (Trigger Job)**: `trigger/review-orchestrator.ts` 负责大流程控制与并发状态管理。
*   **业务逻辑层 (Services)**: 调用 3/3 方案中定义的 `format.service.ts` 等纯函数。
*   **数据访问层 (DAL)**: **强制且仅能使用** `lib/dal/review.admin.dal.ts`，利用 Service Role 绕过 RLS 回写 `stages` 进度和最终 `result`。

## 2. 目录结构与核心任务

```text
/trigger/
  ├── review-orchestrator.ts   # 主调度 Job (Orchestrator)
  └── utils/
      └── pdf-extractor.ts     # PDF 文本提取工具 (用于降级)
/lib/
  ├── actions/
  │   └── trigger.action.ts    # 触发入口：前置校验、扣费、触发 Trigger
  ├── dal/
  │   └── review.admin.dal.ts  # 后台专用的 Supabase DAL (Service Role)
  └── types/
      └── review.ts            # stages 的 JSONB 结构定义
```

## 3. 核心实现细节

### 3.1 业务触发入口 (`lib/actions/trigger.action.ts`)
用户在工作台点击“开始审阅”时，由该 Server Action 接管。**注意：为满足 PRD 要求的资金安全，扣点、写流水和更新状态必须具备强原子性。**

```typescript
"use server"
import { tasks } from "@trigger.dev/sdk/v3";
import { createClient } from "@/lib/supabase/server";

export async function startReviewEngine(reviewId: string) {
  const supabase = await createClient();
  
  // 1. 鉴权与前置校验（页数上限估算等）
  const requiredCredits = calculateRequiredCredits(pageCount);

  // 2. 强原子性扣费与状态流转 (通过 Supabase RPC 保证一致性)
  // RPC `start_review_and_deduct` 会在数据库内部执行：
  //   a. 检查 balance >= requiredCredits
  //   b. 扣减 balance
  //   c. 写入 credit_transactions 流水表
  //   d. 将 reviews 表的 status 更新为 processing，并初始化 stages
  const { data, error } = await supabase.rpc('start_review_and_deduct', {
    p_review_id: reviewId,
    p_required_credits: requiredCredits
  });

  if (error) {
    throw new Error("Insufficient credits or transaction failed: " + error.message);
  }

  // 3. 触发后台编排 Job
  if (process.env.TRIGGER_SECRET_KEY) {
    await tasks.trigger("orchestrate-review", { reviewId });
  } else {
    console.warn("TRIGGER_SECRET_KEY missing, bypassing real orchestration.");
  }
}
```

### 3.2 数据访问层约束 (`lib/dal/review.admin.dal.ts`)
Trigger 运行在无用户请求上下文的 Node.js 中，必须使用 Service Role Key 的 Supabase Client。提供以下接口：
```typescript
import { createAdminClient } from "@/lib/supabase/server";

// 仅限 Trigger 或 Webhook 后台调用
export const reviewAdminDAL = {
  // 更新特定 agent 的进度，用于驱动前端 ProgressConsole 实时打字机
  async updateStageStatus(reviewId: string, agent: string, status: string) {
    const supabase = createAdminClient();
    // 需要通过 RPC 或先查后写的方式，更新 stages JSONB 数组中对应 agent 的对象
    // 例如：将 {"agent": "format", "status": "pending"} 改为 {"agent": "format", "status": "processing"}
  },

  // 全部成功后回写最终报告
  async completeReview(reviewId: string, result: any) {
    const supabase = createAdminClient();
    await supabase.from("reviews")
      .update({ status: "completed", result })
      .eq("id", reviewId);
  },

  // 任务失败处理 (遵循 PRD 8.1 异常挂起与工单系统)
  async suspendToManualReview(reviewId: string, errorMessage: string) {
    const supabase = createAdminClient();
    
    // 1. 状态挂起：前端展示“转交专家人工复核”，安抚用户
    await supabase.from("reviews")
      .update({ status: "needs_manual_review", error_message: errorMessage })
      .eq("id", reviewId);

    // 2. 自动触发系统工单：通知管理员介入 (重试或退款)
    await supabase.from("support_tickets").insert({
      review_id: reviewId,
      priority: "high",
      issue_type: "system_auto_trigger",
      description: `Task FAILED after retries. Error: ${errorMessage}`,
      status: "open"
    });
  }
};
```

### 3.3 主调度 Job (`trigger/review-orchestrator.ts`)

本模块作为纯粹的**调度框架**，采用在一个 Task 内部并发调用业务逻辑层 Service 的模式。真正的批阅业务逻辑全部下沉到 `3/3 核心审阅模块` 中。

**并发原理**：调用大模型是纯网络 I/O 操作，利用 `Promise.allSettled` 可以实现高效的 Node.js 异步 I/O 并发。总耗时取决于最慢的一个任务。
**防阻塞优化**：为防止多模态降级时多个任务并发争抢 CPU 去解析同一个 PDF，引入了 `getParsedText` 懒加载缓存机制。

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { storageDAL } from "@/lib/dal/storage.dal";
import { executeWithFallback } from "./utils/pdf-extractor";
import { analyzeFormat } from "@/lib/services/review/format.service";
// import 其他 services...

export const orchestrateReview = task({
  id: "orchestrate-review",
  run: async (payload: { reviewId: string }, { ctx }) => {
    try {
      // 1. 数据访问层 (DAL): 获取该 review 记录，拿到 fileUrl 和 domain 等 context
      // const review = await reviewAdminDAL.getReviewById(payload.reviewId);
      
      // 2. 数据访问层 (DAL): 从 Storage 下载 PDF 文件为 Buffer
      // const pdfBuffer = await storageDAL.downloadObject(review.fileUrl);

      // 3. 定义防重复解析的懒加载缓存 (避免并发降级时 CPU 阻塞)
      let cachedText: string | null = null;
      const getParsedText = async () => {
        if (!cachedText) {
          const pdfParse = (await import('pdf-parse')).default;
          const data = await pdfParse(pdfBuffer);
          cachedText = data.text;
        }
        return cachedText;
      };

      // 4. 定义高阶函数：执行 Service 并自动同步 stages 状态到数据库
      const runWithProgress = async (agentName: string, serviceFn: () => Promise<any>) => {
        await reviewAdminDAL.updateStageStatus(payload.reviewId, agentName, "processing");
        const result = await serviceFn();
        await reviewAdminDAL.updateStageStatus(payload.reviewId, agentName, "done");
        return result;
      };

      // 5. 业务逻辑层 (Services): 极致的 I/O 并发执行底层 AI 审阅引擎
      const [formatRes, logicRes, refRes] = await Promise.allSettled([
        runWithProgress('format', () => executeWithFallback(analyzeFormat, pdfBuffer, getParsedText, review.domain)),
        // runWithProgress('logic', ...),
        // runWithProgress('reference', ...)
      ]);

      // 6. 数据访问层 (DAL): 聚合结果并回写完成状态
      const finalResult = {
        format: formatRes.status === 'fulfilled' ? formatRes.value : { error: 'Failed' },
        // ... 
      };
      
      await reviewAdminDAL.completeReview(payload.reviewId, finalResult);

    } catch (error: any) {
      console.error("Orchestrator failed:", error);
      // 记录 LLM trace 或全局错误供审计
      // await logTrace('orchestrator', { error: error.message });
      
      // 触发工单和挂起状态
      await reviewAdminDAL.suspendToManualReview(payload.reviewId, error.message || "Unknown orchestration error");
    }
  }
});
```

### 3.4 稳健降级策略 (Fallback)
在 `trigger/utils/pdf-extractor.ts` 中实现降级。为了配合高并发优化，`executeWithFallback` 接收一个 `getParsedText` 函数，避免在多个任务并发降级时重复执行耗时的 PDF 解析。

```typescript
export async function executeWithFallback(
  serviceFn: Function, 
  pdfBuffer: Buffer, 
  getParsedText: () => Promise<string>,
  context: string
) {
  try {
    // 尝试 1: 多模态直喂 (传 Base64)
    return await serviceFn(pdfBuffer.toString('base64'), 'base64', context);
  } catch (error) {
    console.warn("LLM Multimodal failed, falling back to text...", error);
    // 尝试 2: 降级为纯文本 (如果已被其他并发任务解析过，则直接命中缓存)
    const text = await getParsedText();
    return await serviceFn(text, 'text', context);
  }
}
```