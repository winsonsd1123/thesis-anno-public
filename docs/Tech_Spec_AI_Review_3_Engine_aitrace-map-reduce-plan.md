# AI 痕迹预警 (AiTrace) Map-Reduce 重构计划

## 1. 重构背景与上下文
目前 `aitrace.service.ts` 已经基于 V1 版本的“全文一把梭”设计开发完毕。
但经过评估，将几万字的 PDF 全文（或长文本）直接喂给大模型做微观的“AI 痕迹（词汇、句式）”审查，存在以下致命问题：
1. **Lost in the Middle (中间迷失)**：大模型在超长上下文中对微观字句的分辨率极低，极易漏判。
2. **输出崩溃与幻觉**：一旦发现的 AI 痕迹较多，输出的 JSON 数组 Token 容易超限导致截断；且长文本下 `quote_text` 极易出现大模型“幻觉”（瞎编原文）。
3. **定位困难**：仅靠推断的 `chapter` 很难让用户在几万字中精准找到那一句机器味的话。

## 2. 新架构：带页码锚点的 Map-Reduce 并发审查
为了解决上述问题，我们放弃将整个文档一次性丢给 LLM，改为 **Paginated Chunking (带页码锚点的分块并发)** 策略。

### 2.1 核心执行流
1. **文本预处理与分块 (Chunking)**：
   - 在提取 PDF 纯文本时，按页或固定字数进行分块（例如每 5 页 / 3000字 作为一个 Chunk）。
   - **关键**：在每个 Chunk 的文本中，显式注入页码锚点标记，例如：`--- [Page 15] ---`。
2. **并发调度 (Map)**：
   - 将拆分出的多个 Chunk（如 10 个），通过 Trigger.dev 或 `Promise.all` 并发扔给大模型。
   - 大模型在几千字的小窗口内，拿着放大镜执行高分辨率审查。
3. **结果聚合 (Reduce)**：
   - 收集所有 Chunk 返回的 JSON 数组，过滤掉空结果，合并成最终的 `issues` 列表返回给前端。

### 2.2 Schema 结构更新
在原有的 `AiTraceResultSchema` 中，增加绝对的 `page` 字段，并放宽 `chapter` 的推断要求。

```typescript
const AiTraceResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(), // 所在章节 (若块内无明确标题，允许大模型根据上下文就近推断，或填 "上下文缺失")
    page: z.number().int().min(1), // 所在页码 (严格依赖输入文本中的 [Page X] 标记提取)
    quote_text: z.string(), // 原文涉嫌 AI 生成的精确片段（保留 15-40 字）
    issue_type: z.enum([
      'cliche_vocabulary', // 典型 AI 词汇/废话
      'robotic_structure', // 机器味句式 (如三段论)
      'over_symmetrical'   // 过度对称/排比
    ]),
    severity: z.enum(['High', 'Medium', 'Low']),
    analysis: z.string(),
    suggestion: z.string()
  }))
});
```

### 2.3 Prompt 核心指令更新
在 `config/prompts.default.json` (或对应的 Prompt 模板) 中，针对 `ai_trace_system` 增加以下输出格式要求：

```text
**输出格式要求:**
必须且只能返回符合要求的 JSON 数组。每个对象包含：
- `chapter`: 所在章节。请根据文本中出现的最新标题推断，如果当前文本块全是正文无法确定章节，请根据内容简述（如“引言部分”或“方法论段落”）。
- `page`: 整数，问题所在页码。请严格依据文本中插入的 `--- [Page X] ---` 标记，就近提取出准确的页码。
- `quote_text`: 原文涉嫌 AI 生成的精确片段（保留 15-40 字以便作者定位）。
- `issue_type`: 必须是上述 3 个特征维度之一。
- `severity`: 严重程度 (High/Medium/Low)。
- `analysis`: 解释为什么判定它为 AI 生成。
- `suggestion`: 给出具体的“去 AI 味”改写建议。
```

## 3. 执行步骤 (Next Steps)
1. **修改外层 Trigger/调度逻辑**：实现文本的分块与 `[Page X]` 锚点注入。
2. **重构 `aitrace.service.ts`**：调整入参，使其能够接收单个 Chunk 进行无状态审查。
3. **更新 Zod Schema 与 Prompt**：应用上述的 `page` 字段和 Prompt 规则。
4. **测试验证**：用一篇典型的长篇学位论文测试单块与并发效果，验证 `quote_text` 和 `page` 的准确率。