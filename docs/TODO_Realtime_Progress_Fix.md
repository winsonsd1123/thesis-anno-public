# TODO：前端实时进度更新修复方案

**问题描述**：Trigger.dev 任务执行时数据库已更新（刷新后可见），但前端进度面板不实时刷新。

**诊断结论**：数据库侧配置正常（`REPLICA IDENTITY FULL`、`supabase_realtime` publication 已启用、RLS SELECT 策略存在）。问题在前端 Realtime 订阅层。

---

## 根本原因

### 原因 1：订阅无状态处理，失败后无感知
`useReviewRealtime.ts` 调用 `.subscribe()` 时没有传入状态回调，无法感知 `CHANNEL_ERROR`、`TIMED_OUT` 等异常状态，也没有重连机制。长时间运行的审阅（几分钟到十几分钟）期间 WebSocket 很可能静默断连。

```typescript
// 当前代码：无法感知订阅状态
.subscribe();

// 应改为：
.subscribe((status, err) => {
  if (status === 'CHANNEL_ERROR') { /* 重建 channel */ }
  if (status === 'TIMED_OUT') { /* 重建 channel */ }
});
```

### 原因 2：`router` 在 `useEffect` 依赖数组中，触发不必要的取消/重建
每次路由上下文变化（或 `patchFromServer` 触发 re-render 后 next-intl 重新生成 `router` 引用），`useEffect` 清理函数会执行 `supabase.removeChannel(channel)`，然后重新 subscribe。在这个间隙内推送的事件会丢失。

```typescript
// 当前：router 在依赖数组中，可能导致反复重订阅
useEffect(() => { ... }, [reviewId, router]);
```

### 原因 3：无 Polling 兜底，Realtime 失效时只能手动刷新
目前 Realtime 是唯一的推送路径，没有任何降级方案。一旦 WebSocket 断连，前端完全感知不到进度变化。

### 原因 4（防御性）：`parseStages` 不处理 string 类型输入
Supabase Realtime 在某些配置下会把 JSONB 列以 JSON 字符串形式下发，`parseStages` 遇到 string 直接返回 `[]`，导致所有智能体状态被重置为 `pending`，表现为"更新了但看起来没变化"。

```typescript
// 当前：string 输入时直接返回空数组
export function parseStages(raw: unknown): ReviewStageEntry[] {
  if (!Array.isArray(raw)) return [];
  ...
}
```

---

## 修复步骤（按优先级）

### Step 1：加固 `parseStages`（`lib/types/review.ts`）

在 `!Array.isArray(raw)` 分支中，先尝试 `JSON.parse`：

```typescript
export function parseStages(raw: unknown): ReviewStageEntry[] {
  // 兼容 Supabase Realtime 偶发的 JSONB-as-string 行为
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (!Array.isArray(data)) return [];
  // ... 后续逻辑不变
}
```

**文件**：`lib/types/review.ts`
**影响范围**：`normalizeRow` → `patchFromServer` / `hydrateFromReview`

---

### Step 2：修复 `useReviewRealtime`（`lib/hooks/useReviewRealtime.ts`）

**2a. 去除 `router` 依赖，改用 `useRef` 持久持有**

```typescript
const routerRef = useRef(router);
useEffect(() => { routerRef.current = router; }); // 每次 render 同步 ref，不触发订阅重建

useEffect(() => {
  // 依赖数组只保留 reviewId
  ...
  routerRef.current.refresh(); // 用 ref 调用，避免闭包陈旧
}, [reviewId]); // 不再依赖 router
```

**2b. 加订阅状态回调，失败时重建 channel**

```typescript
.subscribe((status, err) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Realtime]', status, err ?? '');
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    // 重建 channel（可通过 rebuildRef 触发 effect 重跑）
  }
});
```

**文件**：`lib/hooks/useReviewRealtime.ts`

---

### Step 3：加入 Polling 兜底（`lib/hooks/useReviewRealtime.ts`）

在同一个 `useEffect` 内，增加 5s 定时轮询，作为 Realtime 失效时的降级方案：

```typescript
// Polling 兜底：每 5s 拉取一次，与 Realtime 互为冗余
const pollInterval = setInterval(async () => {
  const result = await fetchReviewRow(reviewId);
  if (result.ok) {
    useDashboardStore.getState().patchFromServer(result.review as Record<string, unknown>);
    if (isTerminalReviewStatus(result.review.status)) {
      clearInterval(pollInterval);
      routerRef.current.refresh();
    }
  }
}, 5000);

return () => {
  supabase.removeChannel(channel);
  clearInterval(pollInterval);
};
```

**注意**：Realtime 和 Polling 同时更新 store 是安全的（`patchFromServer` 有 id 校验，幂等）。

**文件**：`lib/hooks/useReviewRealtime.ts`

---

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `lib/types/review.ts` | `parseStages` 增加 string → JSON.parse fallback |
| `lib/hooks/useReviewRealtime.ts` | 去除 `router` 依赖、加订阅状态回调、加 5s Polling 兜底 |

---

## 验证方法

1. 启动一个新的审阅任务（触发 Trigger.dev）
2. 在前端进度页保持不刷新
3. 预期：每个智能体状态变化（pending → running → done）在约 5s 内自动反映到 UI
4. 观察浏览器控制台，应无 `[Realtime] CHANNEL_ERROR` 报错

---

## 参考

- [Supabase Realtime postgres_changes 文档](https://supabase.com/docs/guides/realtime/postgres-changes)
- 相关代码：`lib/hooks/useReviewRealtime.ts`、`lib/store/useDashboardStore.ts`、`lib/types/review.ts`
