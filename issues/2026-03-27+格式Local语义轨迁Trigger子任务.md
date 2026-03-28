# 格式 Local 语义轨迁 Trigger 子任务（方案 A 依赖注入）

**日期**: 2026-03-27  
**关联上下文**: 格式核查 Local LLM 并发失控问题，中期优化方案

## 问题背景

格式核查 `analyzeFormat` 中 Local 语义轨（按章分块）走进程内 `Promise.all(LOCAL_BATCH_SIZE=4)`，**完全绕过 `llm-batch-queue`**。5 个并发审阅时最多 20 路 LLM 同时打向 OpenRouter，是系统最大失控并发源；而 aitrace/reference 核查均受队列 `concurrencyLimit: 3` 约束。

## 执行内容

### `lib/services/review/format.service.ts`
- 新增导出类型 `FormatLocalSemanticResult`、`RunFormatLocalChunksFn`（依赖注入接口）
- 新增导出函数 `analyzeFormatLocalChunk(chunk, fr, contentType?)`：单块 Local 语义 LLM 调用，带 `withRetries(3 次)`
- `analyzeFormat` 新增末参 `runLocalChunksFn?: RunFormatLocalChunksFn`（可选，向后兼容）
  - 有注入：走 Trigger 子任务路径
  - 无注入：回退进程内批量，`LOCAL_BATCH_SIZE` 从 **4 降至 2**

### `trigger/review-orchestrator.ts`
- `genericLlmBatchTask` 新增 `action === "format_local_chunk"` handler，调用 `analyzeFormatLocalChunk`
- format plan 段构造 `runLocalChunksFn`：波大小 `FORMAT_LOCAL_WAVE_SIZE = 3`，与 `llm-batch-queue concurrencyLimit: 3` 对齐；失败块降级为 `{ issues: [] }`
- `analyzeFormat` 调用传入 `runLocalChunksFn`
- 顺手修 `AITRACE_WAVE_SIZE: 5 → 3`，注释同步

## 效果

| | 改前 | 改后 |
|---|---|---|
| format local LLM 控制 | 进程内无上限（最多 4/批） | `llm-batch-queue` 全局上限 3 |
| 5 并发审阅时 local 最大并发 | 5 × 4 = **20 路** | 队列共享 **3 路** |
| global / extract 调用 | 不变（各 1 次进程内） | 不变 |
| 物理轨 | 不变（主 worker 纯计算） | 不变 |
| 现有调用方兼容 | — | **完全向后兼容** |
