# AI 审阅引擎实施方案 1/3: 前端交互与三层架构设计 (Conversational UI)

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

严格遵循 App Router 的 Server Component First 架构，划分为展示层、业务逻辑层（Server Actions）和数据访问层（DAL）。

```text
/app/[locale]/dashboard/
  ├── layout.tsx               # [已有] 控制台全局布局，包含顶栏导航等
  ├── (withNav)/               # [已有] 带导航的页面组
  │   ├── page.tsx             # [修改] 控制台首页 (Server Component)，在此处引入工作台内容
  ├── _components/             # [新增] 工作台专属展示层组件
  │   ├── HistorySidebar.tsx   # 侧边栏：历史审阅记录 (Client Component)
  │   ├── ReviewChatBoard.tsx  # 核心对话区：处理本地状态的对话流气泡渲染
  │   ├── UploadForm.tsx       # 包含文件上传与领域填写的表单
  │   ├── PaperCardBubble.tsx  # 展示已上传论文信息的气泡
  │   ├── DomainInfoBubble.tsx # 展示并允许修改论文领域的气泡
  │   ├── PlanConfirmBubble.tsx# 静态生成的审阅计划确认气泡
  │   ├── ProgressConsole.tsx  # 模拟终端的实时任务进度追踪器
  │   └── ReportViewer.tsx     # 最终的多维度审阅报告渲染
/lib/
  ├── dal/                     # [数据访问层] 仅允许在此进行数据库直接交互
  │   ├── review.dal.ts        # reviews 表的 CRUD (读用 GET，写为供 Action 调用的函数)
  │   └── storage.dal.ts       # Supabase Storage 交互 (上传 PDF、获取签名 URL)
  ├── actions/                 # [业务逻辑层] Server Actions
  │   ├── review.action.ts     # 处理表单/上传逻辑，组装 DAL 存库
  │   └── trigger.action.ts    # 负责向后端 Trigger Orchestrator 发送任务请求
  └── store/
      └── useDashboardStore.ts # [状态管理] Zustand 管理跨组件的复杂 UI 状态
```

## 3. 各层核心实现细节

### 3.1 数据访问层 (DAL)
`lib/dal/review.dal.ts` - 封装 Supabase 客户端操作：
```typescript
import { createClient } from '@/utils/supabase/server';

export async function createReviewRecord(userId: string, fileUrl: string, fileName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .insert([{ user_id: userId, file_url: fileUrl, file_name: fileName, status: 'interviewing' }])
    .select('id')
    .single();
  if (error) throw new Error('DB_ERROR: ' + error.message);
  return data.id;
}

// 供页面 Server Component 使用的 GET 请求
export async function getReviewHistory(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data;
}
```

### 3.2 业务逻辑层 (Server Actions)
1. **初始化上传与信息保存 (`review.action.ts`)**:
   前端组件 `UploadForm` 收集到文件和领域信息后，调用 Server Action `initializeReview(formData)`。Action 内调用 `storage.dal` 上传文件，随后调用 `review.dal` 创建记录（同时存入 `domain` 等信息），返回 `reviewId` 存入 Zustand。
2. **静态计划组装**:
   前端获取到文件信息和领域后，直接在 Zustand Store 中本地生成审阅计划数据结构（不再依赖 LLM 和 `/api/chat`）。
3. **触发底层引擎 (`trigger.action.ts`)**:
   前端点击气泡上的“开始审阅”时，调用 `startReviewEngine(reviewId, contextData)`。
   该 Action 负责调用 Trigger.dev SDK 触发 `Tech_Spec_AI_Review_2_Trigger.md` 中的 `orchestrateReview` 任务，并调用 DAL 将状态更新为 `processing`。

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
当状态切为 `processing`，挂载 `ProgressConsole.tsx`。
使用 Supabase 客户端监听 `reviews` 表的 `progress` 字段变化，实现 DeepResearch 般的“打字机终端”效果：
```typescript
const channel = supabase
  .channel('review_progress')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'reviews', filter: `id=eq.${reviewId}` },
    (payload) => {
      // payload.new.progress 包含 Trigger 实时推送的 { format: 'running', logic: 'done', log: '...' }
      // 更新控制台日志和进度条
    }
  )
  .subscribe();
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