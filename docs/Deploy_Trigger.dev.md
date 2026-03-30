# Trigger.dev 部署指南

本文说明如何将本仓库的 **Trigger.dev 后台任务**（AI 论文审阅编排）部署到 Trigger.dev 云端，并与 Next.js 应用（如 Vercel）对齐环境变量。

官方文档：<https://trigger.dev/docs>

---

## 1. 架构关系（必读）

| 组件 | 职责 |
|------|------|
| **Next.js（Vercel 等）** | 用户请求、`startReviewEngine` Server Action 调用 `tasks.trigger("orchestrate-review", …)` 派发 Run |
| **Trigger.dev Cloud** | 执行 `trigger/` 下任务：下载稿件、调用 OpenRouter、通过 Service Role 写回 `reviews` 等 |

两者是**独立部署**：更新 Next.js 不会自动更新 Worker；修改 `trigger/` 或相关 `lib/` 后需重新执行 Trigger 部署命令。

本仓库任务入口与配置：

- 配置文件：`trigger.config.ts`（`dirs: ["./trigger"]`，`maxDuration: 3600`）
- 主任务：`orchestrate-review`（`trigger/review-orchestrator.ts`）
- 子任务：`generic-llm-batch-task`（同文件，队列 `llm-batch-queue`）
- 详细规格：`docs/Tech_Spec_AI_Review_2_Trigger.md`

---

## 2. 前置条件

1. [Trigger.dev](https://trigger.dev/) 账号，并已创建 **Project**。
2. 本地 Node.js 与仓库依赖已安装（`pnpm install`，勿使用 `package-lock.json`；本仓库仅维护 `pnpm-lock.yaml`）。
3. **Supabase** 生产库与 **Storage 桶 `app-config`** 已就绪（Worker 通过 `getPromptsDirect` 等读取配置；失败会回退 `config/prompts.default.json`，但线上应保证 Storage 可用）。
4. **OpenRouter** 生产 API Key 可用。

---

## 3. 本地联调（可选）

终端一：Next.js

```bash
pnpm dev
```

终端二：Trigger 本地 Dev（把 Run 打到 Development 环境）

```bash
npx trigger.dev@latest dev
```

在 Trigger 控制台 **Development** 环境应能看到 `orchestrate-review`、`generic-llm-batch-task` 等 Run。  
本地 `.env.local` 需包含下文「Next.js 侧」变量（含 `TRIGGER_SECRET_KEY` 的 dev key）。

---

## 4. 生产部署 Worker（Trigger.dev）

### 4.1 登录 CLI

```bash
npx trigger.dev@latest login
```

按浏览器提示完成授权。

### 4.2 指定项目与部署

部署前需让 CLI 知道 **Project Ref**（控制台项目设置里可见，形如 `proj_xxxx`）。

推荐在**执行 deploy 的 shell** 中导出（或与 `.env` 一并加载）：

```bash
export TRIGGER_PROJECT_REF=proj_你的项目ref
```

在项目根目录执行：

```bash
npx trigger.dev@latest deploy
```

`trigger.config.ts` 会读取 `TRIGGER_PROJECT_REF` 写入 `project` 字段；若为空，部署可能失败或关联错误项目。

### 4.3 在 Trigger 控制台配置「生产环境变量」

Worker 运行时**不会**自动继承 Vercel 的环境变量，必须在 Trigger.dev 控制台为 **Production**（及你实际使用的环境）单独配置。

下列变量与本仓库代码路径一致（缺省会直接导致任务抛错或无法调 LLM）：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key；**仅后台**，用于 `createAdminClient()`、Storage、RPC |
| `OPENROUTER_API_KEY` | OpenRouter 密钥 |
| `OPENROUTER_HTTP_REFERER` | 可选；未设时部分逻辑会尝试 `NEXT_PUBLIC_APP_URL` |
| `OPENROUTER_APP_TITLE` | 可选；OpenRouter 统计用 `X-Title` |
| `NEXT_PUBLIC_APP_URL` | 可选；与 OpenRouter 头、业务 URL 相关时建议与线上站点一致 |

调试（一般勿开生产）：

- `OPENROUTER_LOG_PROMPTS=1`：将请求/响应写入 Worker 可写目录下的日志（行为见 `lib/integrations/openrouter.ts`）

保存后**重新部署一次 Worker**（若平台要求）或等待配置生效，以控制台说明为准。

---

## 5. Next.js / Vercel 侧环境变量

Server Action `lib/actions/trigger.action.ts` 在扣费成功后调用 `tasks.trigger`，需要：

| 变量 | 说明 |
|------|------|
| `TRIGGER_SECRET_KEY` | Trigger 控制台 **API Keys** 中的 **Secret key**（生产环境用 Production key） |

说明：

- 代码以 **`TRIGGER_SECRET_KEY`** 为准；若 README 中出现其他命名，以本仓库 `trigger.action.ts` 为准。
- 未配置或派发失败时，会走 `rollback_review_after_dispatch_failure`，用户侧可能看到「后台任务未配置 / 启动失败」类提示（见 `messages/zh.json`）。

Vercel 上还需照常配置 Supabase、NextAuth、计费等变量，与 Trigger 无关的不在此重复。

---

## 6. 部署后验收

1. **Trigger 控制台（Production）**：手动或通过站点触发一次审阅，确认出现 `orchestrate-review` Run，且子任务 `generic-llm-batch-task` 按需执行。
2. **队列**：控制台中可见 `main-review-queue`、`llm-batch-queue`（名称以 `trigger/review-orchestrator.ts` 与 `lib/config/queue-limits.ts` 为准）。
3. **数据库**：`reviews.trigger_run_id` 有值，`stages` 随进度更新，终态与计费符合预期。
4. **日志**：若任务失败，结合 Trigger Run 日志与 Supabase `reviews.error_message` 排查。

---

## 7. 常见问题

**控制台没有 Run**  
核对：`TRIGGER_SECRET_KEY` 是否对应 **Production**、Project 是否与 `TRIGGER_PROJECT_REF` 一致、Vercel 是否已重新部署并带上新环境变量。

**Worker 报 Supabase / OpenRouter 错误**  
在 Trigger 控制台检查 **Production** 环境变量是否完整，尤其是 `SUPABASE_SERVICE_ROLE_KEY` 与 `OPENROUTER_API_KEY`。

**只改了 `trigger/` 或编排依赖的 `lib/`**  
必须重新执行 `npx trigger.dev@latest deploy`；仅部署 Vercel 不足以更新 Worker。

**超时**  
`trigger.config.ts` 中 `maxDuration: 3600`（秒）；超长任务仍失败时需从业务拆分或官方限额文档排查。

---

## 8. 参考文件

| 文件 | 内容 |
|------|------|
| `trigger.config.ts` | Trigger 工程配置、`build.external` |
| `trigger/review-orchestrator.ts` | 任务 id、队列、编排逻辑 |
| `lib/actions/trigger.action.ts` | 派发与 `TRIGGER_SECRET_KEY` |
| `docs/Tech_Spec_AI_Review_2_Trigger.md` | 触发与数据流规格 |
