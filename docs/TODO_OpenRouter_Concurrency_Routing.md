# TODO：OpenRouter 并发、限流与成本优化

> 状态：待办（Backlog）  
> 关联：`lib/integrations/openrouter.ts`、`trigger/review-orchestrator.ts`、各 `lib/services/review/*.service.ts`  
> 背景：多引擎 + Map-Reduce 子任务易在同一账户上打满 RPM/429；限流为 **账户级全局**，多 API Key 无效（见 [OpenRouter Limits](https://openrouter.ai/docs/api/reference/limits)）。

---

## 官方要点（实施前复核文档）

- 用 `GET https://openrouter.ai/api/v1/key` 查看余额与当前档位对 RPM 的影响。
- [Provider Routing](https://openrouter.ai/docs/provider-routing)：默认跨 Provider 负载均衡；`models` 数组 + `provider.sort.partition: "none"` 可跨模型选吞吐最高端点。
- [Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)：主模型限流时可自动试备选模型。
- [Prompt Caching](https://openrouter.ai/docs/features/prompt-caching)：Gemini 隐式缓存 + 显式 `cache_control`（仅最后一个断点对 Gemini 生效）；与 Vercel AI SDK 透传需单独验证。

---

## Phase 1：零/低代码（运维与配置）

- **充值 credits**：提升账户级 RPM 上限（OpenRouter 随余额动态调整，无固定公开 RPM 表）。
- **评估 `:nitro` 后缀**：对高频、可接受溢价的路径（如 AITrace / Format Local）在模型 ID 上加 `:nitro`，等价吞吐优先路由；上线前对比成本与 429 率。
- **BYOK**：在 OpenRouter 后台配置 Google / Anthropic 等自有 Key，使部分请求走自有配额（见 OpenRouter BYOK 文档）。

---

## Phase 2：路由与降级（中等代码量）

- **Model fallback 列表**：在配置或代码层为 Logic / Format Global / AITrace 等提供 `models: string[]`（同能力近似模型），避免单模型打满。
- **确认 AI SDK 透传**：`@openrouter/ai-sdk-provider` 的 `generateObject` 是否支持请求体里的 `provider` / `models`；若不支持，评估自定义 `fetch` 或降级为直连 OpenRouter HTTP。
- **429 退避**：在 review 服务层对 429 做指数退避 + 抖动（与 Trigger 任务重试策略对齐，避免惊群）。

---

## Phase 3：架构分流（可选，高收益）

- **高频引擎直连 Google AI Studio / Vertex**：将 AITrace、Format Local 等「多 chunk、Flash 级」调用从 OpenRouter 迁出，OpenRouter 保留需 `:online`、多厂商统一账单的引擎（如 Reference）。
- **Prompt Caching**：对长 Markdown 统一前缀 + `cache_control` 或依赖 Gemini 隐式缓存；与 Logic Pass1/Pass2、Format 并行请求的结构对齐（见 OpenRouter Prompt Caching 文档）。

---

## Phase 4：与编排/队列联动（此前架构讨论）

- **本地预检**：Parser 后规则拦截明显不合格论文，减少无效 LLM 调用（与 `format-rules.engine` 思路一致）。
- **AITrace 动态抽样**：先抽头/中/尾 chunk，低嫌疑再全量 Map-Reduce。
- **Trigger 队列 `concurrencyLimit`**：与 OpenRouter 实际 RPM 联调，避免子任务并发过高导致全局 429。

---

## 完成定义

- 生产环境监控：OpenRouter Activity / 日志中 429 占比可接受；单篇审阅 P95 延迟不劣化或明确可接受。
- 成本：对比优化前后 Token 账单与 OpenRouter 账单（若启用 BYOK/直连需分渠道统计）。

