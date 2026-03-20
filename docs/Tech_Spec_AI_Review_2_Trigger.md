# AI 审阅引擎实施方案 2/3: Trigger 编排与降级策略 (Orchestrator)

## 1. 模块定位
基于 `@trigger.dev/sdk`，负责接收前端发起的审阅请求，下载文件，并发调度底层的 AI 审阅引擎，并将执行进度和结果实时同步到 Supabase 数据库。

## 2. 目录结构与核心任务

```text
/trigger/
  ├── review-orchestrator.ts   # 主调度 Job (Orchestrator)
  ├── tasks/
  │   ├── format-task.ts       # 格式检查子任务
  │   ├── logic-task.ts        # 逻辑检查子任务
  │   └── reference-task.ts    # 参考文献检查子任务
  └── utils/
      ├── supabase.ts          # Trigger 专用的 supabase 服务端客户端
      └── pdf-extractor.ts     # PDF 文本提取工具 (用于降级)
```

## 3. 核心实现细节

### 3.1 主调度 Job (`review-orchestrator.ts`)
```typescript
import { task, wait } from "@trigger.dev/sdk/v3";
// 引入子任务
import { formatCheckTask } from "./tasks/format-task";
// ...

export const orchestrateReview = task({
  id: "orchestrate-review",
  // 1. 接收 payload: { reviewId, fileUrl, context }
  run: async (payload, { ctx }) => {
    // 2. 更新数据库状态为 processing
    await updateReviewStatus(payload.reviewId, 'processing', { 
      format: 'pending', logic: 'pending', reference: 'pending' 
    });

    // 3. 下载 PDF 文件为 Buffer (可复用)
    const pdfBuffer = await downloadFromStorage(payload.fileUrl);

    // 4. 并发触发子任务 (使用 trigger.batch 或 Promise.all 包裹 trigger.invoke)
    // 注意：如果是拆分了独立的 Task，需要序列化 buffer。
    // 如果为了简单，MVP 阶段可以直接在一个大 Job 里并发执行 Service 方法。
    // 这里采用在一个 Task 内部并发调用 Service 的模式，避免序列化大文件的开销。
    
    // 5. 等待执行并捕获异常...
  }
});
```

### 3.2 MVP 并发执行策略 (推荐)
为了避免 Trigger 子任务间传递巨大的 Base64 导致超时或报错，建议在 `orchestrateReview` 内部直接并发调用 `services/review/*`：

```typescript
// 伪代码示例
const [formatResult, logicResult, referenceResult] = await Promise.allSettled([
  runWithProgressUpdate('format', () => formatService.analyze(pdfBase64)),
  runWithProgressUpdate('logic', () => logicService.analyze(pdfBase64, payload.context)),
  runWithProgressUpdate('reference', () => referenceService.analyze(pdfBase64))
]);

// 将成功的写入结果，失败的写入错误信息
await saveResultsToSupabase(payload.reviewId, {
  result_format: formatResult.status === 'fulfilled' ? formatResult.value : { error: 'Failed' },
  // ...
});
```

### 3.3 稳健降级策略 (Fallback)
在 `utils/pdf-extractor.ts` 中实现基于 `pdf-parse` 的文本提取。
在包裹执行时加入重试逻辑：

```typescript
async function executeWithFallback(serviceFn, pdfBuffer, context) {
  try {
    // 尝试 1: 多模态直喂 (传 Base64)
    return await serviceFn(pdfBuffer.toString('base64'), context, 'base64');
  } catch (error) {
    console.warn("LLM Multimodal failed, falling back to text...", error);
    // 尝试 2: 降级为纯文本
    const text = await extractTextFromPDF(pdfBuffer);
    return await serviceFn(text, context, 'text');
  }
}
```