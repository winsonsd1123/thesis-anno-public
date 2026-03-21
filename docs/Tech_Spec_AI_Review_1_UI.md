# AI 审阅引擎实施方案 1/3: 前端交互与三层架构设计 (Conversational UI)

> **文档同步**：下文目录与代码路径以仓库当前实现为准（2026-03-21）。与初版差异包括：`reviews` 用户写操作走 **`createClient` + RLS**；无 JWT 的后台写库集中在 **`review.admin.dal.ts`**；PDF 页数在浏览器用 **`pdfjs-dist`** 解析；审阅详情只读使用 **`GET /api/reviews/[id]`**。

## 1. 模块定位与交互范式 (DeepResearch 风格)
本模块负责实现类似 **DeepResearch** 的 Agentic UI 工作台。它接管用户上传 PDF、收集领域意图、展示调度进度、以及最终渲染审阅报告的全生命周期。

**核心交互链路 (DeepResearch 风格)：**
1. **沉浸式开局与信息录入**：页面中心提供一个简洁的上传表单，用户在上传 PDF 论文的同时，需选择或填写该论文的所属领域（如计算机、医学等）。
2. **气泡式状态展示**：上传并提交后，对话序列中会立刻出现两个气泡：一个是「论文卡片气泡」，另一个是「收集到的论文所属领域气泡」。
3. **领域修改与计划重新生成**：用户可以直接在「领域气泡」中修改论文的所属领域。修改后，系统会依据新领域重新生成审阅计划。
4. **静态计划确认**：系统得到论文和领域信息后，立刻在对话流中输出一个「审阅计划气泡」。该计划**完全由系统根据自身能力（如格式检查、逻辑审查、参考文献核查）结合论文领域静态生成，不再调用 LLM**。气泡底部包含一个“开始审阅”按钮。
5. **实时进度跟踪**：用户点击“开始审阅”后，对话框进入锁定/等待状态，界面平滑过渡到任务进度视图。每当后端 Trigger 完成一个子任务，进度条和日志终端会像打字机一样实时滚动更新。
6. **多维报告渲染**：任务全部完成后，界面切换为报告展示模式（分为结构完整性、逻辑深度、参考文献核查三个 Tab），支持下载导出。
7. **历史会话管理 (Sidebar)**：左侧边栏（可折叠）列出过往的审阅记录。点击历史记录，系统会从数据库拉取对应记录的 `status` 和报告数据，无缝恢复到对应的 UI 视图（如继续查看进度或直接阅读报告）。

## 2. 目录结构与三层架构划分

严格遵循 App Router 的 **Server Component First** 架构：页面与数据预取以 RSC 为主；工作台内交互为 Client Components。领域上划分为 **展示层**、**业务层（Server Actions / Route Handler）**、**数据访问层（DAL）**；**`lib/services/review.service.ts`** 为审阅域对外唯一入口（Actions / API 不直连 DAL）。

```text
/app/[locale]/dashboard/
  ├── layout.tsx               # 控制台全局布局
  ├── (withNav)/
  │   ├── page.tsx             # 首页 RSC：预取历史列表与余额，挂载 ReviewWorkbench
  │   ├── billing/ … settings/ …
  ├── _components/             # 工作台展示层（Client）
  │   ├── ReviewWorkbench.tsx  # 壳：侧栏 + 主面板 Tab（对话 / 进度 / 报告）
  │   ├── HistorySidebar.tsx   # 历史列表；支持重命名、删除
  │   ├── ReviewChatBoard.tsx  # 对话流、上传、领域、计划、开始审阅
  │   ├── ChatMessageRows.tsx  # 对话消息行渲染
  │   ├── UploadForm.tsx
  │   ├── PaperCardBubble.tsx / DomainInfoBubble.tsx / PlanConfirmBubble.tsx
  │   ├── ProgressConsole.tsx
  │   └── ReportViewer.tsx     # 报告三 Tab（当前以 JSON 文本展示各子结果）
/app/api/reviews/[id]/route.ts # GET 审阅详情（只读，JWT + RLS）
/lib/
  ├── dal/
  │   ├── review.dal.ts        # 用户 JWT：列表/详情/用户发起的 insert/update/delete 等（RLS 兜底）
  │   ├── review.admin.dal.ts  # Service Role：仅后台编排回写 status/stages/result 等（无用户会话场景）
  │   └── storage.dal.ts       # Service Role：Storage 上传/删除（bucket thesis-pdfs）
  ├── services/
  │   └── review.service.ts    # 聚合 reviewDAL / reviewAdminDAL，供 Action 与 Route 调用
  ├── actions/
  │   ├── review.action.ts     # initializeReview、updateDomain、rename、delete、replaceReviewPdf
  │   └── trigger.action.ts    # startReviewEngine（写 processing + 可选 Trigger）
  ├── client/
  │   ├── pdfPageCount.ts      # 浏览器 pdfjs 解析页数
  │   └── fetchReviewRow.ts    # GET /api/reviews/[id] 客户端封装
  ├── hooks/useReviewRealtime.ts
  ├── review/buildStaticPlan.ts / stagesUi.ts
  ├── types/review.ts
  └── store/useDashboardStore.ts
```

## 3. 各层核心实现细节

### 3.1 数据访问层 (DAL)
- **`review.dal.ts`**：一律 `await createClient()`（用户 Cookie 会话）。在表上启用 RLS 的前提下，**用户发起的写库**（insert、更新 file/domain、重命名、删除、`updateProcessingStart` 等）与读库均受策略约束，避免 Action 层疏漏时 Service Role 越权写任意行。
- **`review.admin.dal.ts`**：`createAdminClient()`，仅供 **无用户 JWT** 的 Trigger / 后台任务更新 `stages`、`result`、终态等；不得从面向用户的 Action 直接调用。
- **`storage.dal.ts`**：大文件上传/删除仍用 Service Role（Storage 策略与 DB RLS 分离）。

业务代码通过 **`reviewService`** 调用上述 DAL，而非在 Action 内散落 Supabase 调用。RSC 列表/详情示例（路径示意）：

```typescript
import { createClient } from "@/lib/supabase/server";
import { reviewService } from "@/lib/services/review.service";

// RSC：按 userId 拉历史（与 page.tsx 一致时可委托 reviewService.listReviewsForUser）
const supabase = await createClient();
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) { /* redirect */ }
const rows = await reviewService.listReviewsForUser(auth.user.id);
```

新建记录由 Action 内 `reviewService.insertReview({ userId, fileUrl, fileName, domain, pageCount })` 完成；**初始 `status` 为 `pending`**（非示例中的 `interviewing`）。

### 3.2 业务逻辑层 (Server Actions / API)
1. **初始化上传与信息保存 (`review.action.ts`)**:
   `UploadForm` 在浏览器用 `pdfjs-dist` 得到页数后，将 `file`、`domain`、`pageCount` 一并提交。`initializeReview(formData)` 校验认证与大小/MIME 后，调用 `storageDAL.uploadReviewPdf` 与 **`reviewService.insertReview`**，返回 `reviewId` 写入 Zustand。
2. **领域与文件维护**:
   - `updateReviewDomain` → `reviewService.updateDomain`。
   - `renameReview` / `deleteReview` → `reviewService`；删除成功后尝试 **`storageDAL.removeObject`** 清理 PDF。
   - `replaceReviewPdf`：仅当 `status === "pending"` 时替换文件并 `updateReviewFile`，并删除旧 Storage 对象（尽力而为）。
3. **静态计划组装**:
   前端根据领域调用 `buildStaticPlan`，在 Store 中生成计划气泡数据（无 LLM）。
4. **触发底层引擎 (`trigger.action.ts`)**:
   「开始审阅」调用 `startReviewEngine`：校验余额与页数上限后，经 **`reviewService.updateProcessingStart`**（用户客户端 + RLS）写入 `processing` 与初始 `stages`；若配置了 Trigger 密钥则触发 `orchestrate-review`（详见 `Tech_Spec_AI_Review_2_Trigger.md`）。**扣点与事务**仍待与计费模块闭环。
5. **只读详情（GET）**:
   切换历史或刷新上下文时，客户端使用 **`fetchReviewRow(reviewId)`** → `GET /api/reviews/[id]`，避免用 Server Action 做纯查询。

### 3.3 前端展示层 (Presentation)
1. **工作台嵌入与历史会话恢复 (`page.tsx` & `HistorySidebar.tsx`)**:
   工作台作为主体内容嵌入在 `app/[locale]/dashboard/(withNav)/page.tsx` 中（当前控制台的下栏/主内容区）。
   在 `page.tsx` (Server Component) 中预取的历史列表会作为 initial data 传给 Sidebar。用户点击某条记录时，通过调用 `store.setReviewId` 切换当前上下文，并拉取该记录对应的 `status`。UI 将根据状态字段无缝切换回对话框、打字机进度台或最终的报告展示界面。
2. **对话流气泡渲染 (`ReviewChatBoard.tsx`)**:
   维护一个本地的 `bubbles` 数组（存在 Zustand 中），用于按顺序渲染交互气泡，彻底替代了 Vercel AI SDK 的 `useChat`。
```typescript
// 示例：基于本地状态渲染交互气泡
{bubbles.map(bubble => {
  if (bubble.type === 'paper_info') {
    return <PaperCardBubble key={bubble.id} data={bubble.data} />;
  }
  if (bubble.type === 'domain_info') {
    // 允许用户在此修改领域，修改后自动刷新下方的计划气泡
    return <DomainInfoBubble key={bubble.id} data={bubble.data} onEdit={handleDomainEdit} />;
  }
  if (bubble.type === 'review_plan') {
    // 静态生成的审阅计划，包含明确的检查项和所属领域
    return <PlanConfirmBubble key={bubble.id} plan={bubble.data} onStart={handleStartReview} />;
  }
  return null;
})}
```

### 3.4 进度实时监听 (Supabase Realtime)
当状态为 `processing`，由 `useReviewRealtime` 订阅 `public.reviews` 上 `id=eq.{reviewId}` 的 **`UPDATE`**。实现上消费整行变更，其中 **`stages`（JSONB 数组）** 经 `stagesUi` 映射为 `ProgressConsole` 的进度条与日志；**不存在单独的 `progress` 列**（与早期规格示例不同）。
```typescript
// 逻辑位置：lib/hooks/useReviewRealtime.ts — 订阅后 merge 到 Zustand patchFromServer
// payload.new.stages、payload.new.status、payload.new.result 等驱动 UI
```

## 4. 核心数据结构与前端消费逻辑
> ⚠️ **注意**: 完整的表结构请参考全局数据库设计文档 `AI_Thesis_Review_Database_Schema_v2.0.md`。此处仅说明前端 UI 层如何消费 `reviews` 表的核心字段。

前端主要依赖 `reviews` 表的以下字段来驱动工作台状态机和 UI 渲染：

*   **`status` (Enum)**: 决定整个工作台的大状态。
    *   `pending` / `processing`: 显示进度终端 (`ProgressConsole.tsx`)。
    *   `completed`: 渲染最终的 Tab 报告 (`ReportViewer.tsx`)。
    *   `failed` / `needs_manual_review`: 弹出错误提示，并引导用户发起工单 (`support_tickets`)。
*   **`stages` (JSONB)**: 进度追踪数组。例如 `[{"agent": "format", "status": "done"}]`。
    *   **消费逻辑**: `ProgressConsole.tsx` 监听此字段变化，将各个 agent 的状态映射为终端里的进度条和打字机日志输出。
*   **`result` (JSONB)**: 最终的审阅报告。
    *   **消费逻辑**: 当任务完成时，`ReportViewer.tsx` 解析此 JSON，按结构分配给「格式检查」、「逻辑审查」、「参考文献」三个子 Tab 渲染。
*   **`error_message` (Text)**: 
    *   **消费逻辑**: 若任务失败，在 UI 中心醒目展示此错误原因，并允许用户一键复制去提工单。

---

## 5. 工程配置备忘
- **`next.config.ts`**：`experimental.serverActions.bodySizeLimit` 提升至 **52mb**，与 PDF 上传体积一致。
- **国际化**：文案键位于 `messages/zh.json`、`messages/en.json` 的 `dashboard.review` 等命名空间。

---

## 6. 关联文档
- 实施记录与差异表：[issues/2026-03-21+AI审阅工作台.md](../issues/2026-03-21+AI审阅工作台.md)
- 需求追踪 RTM：[AI_Thesis_Review_Requirement_Traceability.md](./AI_Thesis_Review_Requirement_Traceability.md)
- 数据库字段全貌：[AI_Thesis_Review_Database_Schema_v2.0.md](./AI_Thesis_Review_Database_Schema_v2.0.md)