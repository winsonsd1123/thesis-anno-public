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

export async function startReviewEngine(reviewId: number) {
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

本模块作为纯粹的**调度框架**，负责编排底层 AI 审阅引擎。特别是对于需要高并发且容易触发 API 限流（Rate Limit 429）的参考文献核查任务，必须利用 Trigger.dev 的 `batchTrigger` 或子任务特性进行全局并发控制。

**企业级并发与调度原理**：
1. **全局主任务排队**：为了防止大量用户同时涌入导致系统崩溃，主任务 `orchestrate-review` 必须配置专属队列并限制并发（如 `concurrencyLimit: 5`）。超出的请求将在 Trigger 平台排队，不会打挂服务器。
2. **通用子任务批处理 (Generic Subtask Batching)**：不写死特定业务的子任务。设计一个通用的 `generic-llm-batch-task`。对于大量文献的核查，采用“攒批”策略（如每 10 条一批），通过同一 Task 上的 `batchTriggerAndWait`（即 `genericLlmBatchTask.batchTriggerAndWait`）并发调度这几个批次；亦可用 `batch.triggerByTaskAndWait` 传入 `{ task, payload }[]` 等价触发。

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { storageDAL } from "@/lib/dal/storage.dal";
import { executeWithFallback } from "./utils/pdf-extractor";
import { analyzeFormat } from "@/lib/services/review/format.service";
import { extractReferencesFromPDF, verifyReferenceBatch } from "@/lib/services/review/reference.service";

/** 内联分块，避免引入 lodash */
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 定义通用的 LLM 批处理子任务 (可复用于其他需要批量调 LLM 的场景)
export const genericLlmBatchTask = task({
  id: "generic-llm-batch-task",
  queue: {
    name: "llm-batch-queue",
    concurrencyLimit: 5 // 全局限制：同时最多只有 5 个批处理请求打向 OpenRouter
  },
  run: async (payload: { action: string, dataBatch: any[], context: any }) => {
    if (payload.action === 'verify_references') {
      return await verifyReferenceBatch(payload.dataBatch, payload.context);
    }
    // else if (payload.action === 'other_batch_action') ...
    throw new Error("Unknown batch action");
  }
});

// 主调度任务
export const orchestrateReview = task({
  id: "orchestrate-review",
  queue: {
    name: "main-review-queue",
    concurrencyLimit: 5 // 核心保护：主审阅任务全局并发上限（与业务可承受的排队深度一致）
  },
  run: async (payload: { reviewId: number }) => {
    try {
      // 1. 数据访问层 (DAL): 获取记录与 PDF Buffer
      // ... (省略懒加载解析代码，见 trigger/review-orchestrator.ts)

      // 2. 并发执行常规审阅 (Format / Logic)
      const [formatRes, logicRes] = await Promise.allSettled([
        runWithProgress('format', () => executeWithFallback(analyzeFormat, pdfBuffer, getParsedText, ctx)),
        // runWithProgress('logic', ...)
      ]);

      // 3. 参考文献核查 (分块 + 通用子任务并发调度)
      // stages 的 status 仍为 pending|running|done|failed；细分阶段可写入 RPC 的 log 字段
      await reviewAdminDAL.updateStageStatus(payload.reviewId, 'reference', "running", "extracting references");
      const refListRaw = await executeWithFallback(extractReferencesFromPDF, pdfBuffer, getParsedText, ctx);
      const refList = Array.isArray(refListRaw) ? refListRaw : [];

      await reviewAdminDAL.updateStageStatus(payload.reviewId, 'reference', "running", "verifying references");

      // b. 将文献切分成多块，每块 10 条 (大大减少 LLM 调用次数)
      const refChunks = chunkArray(refList, 10);

      // c. 组装为通用批处理任务的 batch items（推荐：Task 实例上的 batchTriggerAndWait）
      const batchPayloads = refChunks.map(dataBatch => ({
        payload: { action: 'verify_references', dataBatch, context: ctx }
      }));

      // d. 抛给 Trigger.dev 进行分布式排队和并发执行
      const batchResult = await genericLlmBatchTask.batchTriggerAndWait(batchPayloads);

      // e. 将分块的结果拍平 (flatten) 为一个一维数组
      const refFinalRes = batchResult.runs.flatMap(run =>
        run.ok && Array.isArray(run.output) ? run.output : []
      );

      // 4. 聚合结果并回写完成状态
      const finalResult = {
        format: formatRes.status === 'fulfilled' ? formatRes.value : { error: 'Failed' },
        reference: refFinalRes
      };

      await reviewAdminDAL.completeReview(payload.reviewId, finalResult);

    } catch (error: any) {
      console.error("Orchestrator failed:", error);
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