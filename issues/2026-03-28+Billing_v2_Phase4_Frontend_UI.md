# Billing v2.0 阶段四：前端交互重构

**日期**：2026-03-28  
**状态**：已完成，tsc 零错误

---

## 背景

阶段三（局部退款引擎）已通过 QA。本阶段聚焦两个前端目标：

1. **`PlanConfirmBubble` 逐模块积分标注 + 积分不足警示**（Spec 步骤 9）
2. **`ReportViewer` 失败 Tab 退款通知**（Spec 步骤 10）

---

## 数据流变更

```
Page Server
  └─ balance ──► ReviewWorkbench
                    ├─ balance ──────► ReviewChatBoard
                    │                     └─ breakdown ─► PlanConfirmBubble（逐模块 +N 点）
                    │                     └─ insufficientCredits ─► PlanConfirmBubble（警示 + 禁用按钮）
                    └─ agentRefunds ─► ReportViewer（失败 Tab 退款通知）
```

---

## 文件变更

| 文件 | 变更内容 |
|------|----------|
| `messages/zh.json` | 新增 `planStepCost`（"+{credits} 点"）、`planInsufficientCredits`（"积分不足，请先充值"）、`reportModuleRefundNotice`（退款通知文案） |
| `messages/en.json` | 同上英文版 |
| `PlanConfirmBubble.tsx` | 新增 `stepCosts`、`insufficientCredits`、`insufficientCreditsHint`、`rechargeHref` 四个 props；勾选项右侧展示 `+N` badge；统计区展示积分不足警示；开始按钮在积分不足时禁用 |
| `ReviewChatBoard.tsx` | 新增 `balance` prop；新增 `planEstimatedBreakdown` state；从 `estimateCost` 结果中提取 `breakdown`；计算 `insufficientCredits`；向 `PlanConfirmBubble` 传递新 props |
| `ReviewWorkbench.tsx` | 传 `balance` 给 `ReviewChatBoard`；新增 `agentRefunds` memo（遍历 `stages` 收集 `refunded_at` 非空的退款记录）；向 `ReportViewer` 传 `agentRefunds` |
| `ReportViewer.tsx` | 新增 `agentRefunds` prop；定义 tab→agent 映射；当 activePayload 有 `error` 且 `agentRefunds[agent]` 存在时，在 `ReportStructuredBody` 上方渲染橙色退款通知 banner |

---

## 关键实现细节

### 逐模块积分标注

- 仅对**当前已勾选**且 `breakdown` 中存在对应键的模块展示 `+N` badge（仅勾选项可知具体字数区间的单价）
- `breakdown` 来自 `estimateCost` 的 `CostBreakdownSnapshot`，已在阶段二中随 planOptions 变化而重算

### 积分不足检测

- 判断条件：`planEstimatedCredits != null && balance != null && planEstimatedCredits > balance`
- 触发效果：统计区显示红字警示 + 充值跳转链接（`→`），开始按钮置为 disabled（`insufficientCredits` 独立于 `disabled` prop，二者叠加）

### 退款通知 Banner

- `agentRefunds` 由 `ReviewWorkbench` 从 `activeReview.stages` 中派生，仅包含 `refunded_at` 非空（退款已完成）的 agent
- Tab→agent 映射：`structure→format`、`logic→logic`、`aitrace→aitrace`、`refs→reference`
- 仅当 `activePayload` 含 `error` 字段**且** `agentRefunds[agent]` 存在时展示；skipped 或正常完成的 Tab 不展示

---

## 验收

- `pnpm exec tsc --noEmit` 零错误 ✅
- 逐模块积分标注：pending 状态勾选/取消模块，右侧 `+N` badge 随 breakdown 动态更新
- 积分不足：余额 < 预估点数时，警示文案出现，开始按钮灰化
- 退款通知：已完成任务中有模块失败且已退款的 Tab，顶部展示橙色通知 banner
