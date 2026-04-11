# 20260412 登录等待反馈优化

**上下文**：登录在弱网下「像没反应」，需强化加载态与慢网提示。

**计划摘要**：

1. `globals.css`：`.btn-primary:disabled` 禁用态。
2. `login/page.tsx`：`Loader2`、表单 `aria-busy`、pending 时禁用输入与模式切换、7s 慢网提示、`common.networkError` 由服务端映射（见 `auth.actions.ts`）。
3. i18n：`slowNetworkHint`、`networkError`（中英）。

**状态**：已按方案实现。
