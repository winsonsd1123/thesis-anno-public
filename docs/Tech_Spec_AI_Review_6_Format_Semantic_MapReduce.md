# 格式审查语义轨：Map-Reduce 按章分块并发架构设计

## 1. 背景与动机
在当前版本的 AI 审阅引擎中，格式审查的“语义轨”（Semantic Track）将整篇论文的 Markdown 一次性丢给大模型（如 Gemini-3-Pro）进行审查。
这种“全文一把梭”的方式在处理几万字的长篇学位论文时，存在以下致命缺陷：
1. **Lost in the Middle（中间迷失）**：大模型对超长上下文中的微观错误（如局部图表不匹配、单句语病）分辨率极低，容易漏报。
2. **输出崩溃**：长文本审查极易触发 Token 截断，且返回的 `quote_text` 容易产生幻觉（瞎编原文）。
3. **性能与资源浪费**：如果只是为了找个错别字，让大模型吞吐几万字是非常不经济的。

因此，必须引入 **Map-Reduce** 思想。为了防止分块导致大模型丧失全局视野（如误报“缺失摘要”或无法核对跨章的“标题层级错乱”），我们采用 **Global Pass (全局骨架) + Local Pass (按章局部细查)** 的双轨并发策略。

## 2. 核心架构设计：Global + Local Map-Reduce

整个语义轨将被拆分为两个独立的审查维度，最后在服务层合并（Reduce）结果。

### 2.1 Global Pass (全局宏观审查)
- **输入构造**：仅提取整篇文档的**全部标题目录树**（Heading Tree） + **前置部分**（文档开头到正文第一章之前，通常包含摘要）。
- **审查目标**：
  - `structural_missing`（必备结构缺失，如无摘要、无参考文献）。
  - `heading_hierarchy_error`（标题层级错乱，如 1.1 直接跳到 1.3，跨章层级不一致）。
- **优势**：输入极短（通常不到 2000 字），大模型视野清晰，能精准抓出结构性大忌。

### 2.2 Local Pass (局部微观审查 / Map 并发)
- **输入构造**：将文档按照“章”（Top-level Heading，通常是 `#` 或特定的中文章节正则）进行物理切断。分为：`[前置摘要区, 第一章, 第二章, ..., 参考文献与附录]`。
- **审查目标**：
  - `figure_table_mismatch`（图表编号与正文引用对不上）。
  - `typo_and_grammar`（错别字与语病）。
  - `terminology_inconsistency`（本章内术语不一致）。
  - `ai_use_disclosure`（AI 使用披露规范）。
- **限制要求**：必须在 Prompt 中**严禁**该模型报告结构性缺失问题（防止只看了第一章就大喊“缺少参考文献”）。

## 3. 具体实施步骤与文件修改清单

### 3.1 编写 Markdown 分块器 (Chunker)
**文件**：`lib/review/format-markdown-chunks.ts` (新建)
- **功能 1：`extractGlobalSkeleton(markdown: string)`**
  - 提取逻辑：正则匹配所有的 ATX 标题（`#` 到 `######`），保留层级结构。同时截取文档开头到第一个疑似“第一章”或“绪论”标题前的纯文本（约前 2000 字），拼接作为 Global Pass 的输入。
- **功能 2：`splitMarkdownByChapters(markdown: string)`**
  - 提取逻辑：按顶级标题（H1 `# `）或明显的章节标志划分 Chunk。保证每块包含一个完整的章节。
  - 对于超长的章节，如果超过 6000 字，可以考虑进一步按 H2 切分（避免单章也超限）。

### 3.2 拆分与配置 Prompt
**文件**：`config/prompts.default.json`
将原来的 `format_review_system` 拆分为两个独立的 Prompt：
1. **`format_semantic_global_system`**
   - 强调：“你现在进行的是全局结构审查，只能输出 `structural_missing` 和 `heading_hierarchy_error` 两种错误类型。请根据提供的目录树和前置摘要进行判断。”
2. **`format_semantic_local_system`**
   - 强调：“你现在进行的是局部章节审查。**绝不允许**报告缺少摘要、参考文献等整体结构缺失问题！请集中精力寻找当前片段内的 `figure_table_mismatch`、`typo_and_grammar` 等微观错误。”

### 3.3 重构 `format.service.ts` (核心调度逻辑)
**文件**：`lib/services/review/format.service.ts`
- **入参上下文类型修改**：
  - `FormatSemanticContextPayload` 需要包含两个 prompt：`globalPromptTemplate` 和 `localPromptTemplate`。
- **执行逻辑重构 (`analyzeFormat`)**：
  ```typescript
  // 1. 调用分块器
  const globalSkeleton = extractGlobalSkeleton(markdown);
  const localChunks = splitMarkdownByChapters(markdown);

  // 2. 构造 Global Task
  const globalTask = withRetries(() => generateObject({
    system: globalPrompt,
    messages: [{ role: "user", content: globalSkeleton }],
    schema: GlobalSemanticResultSchema
  }));

  // 3. 构造 Local Tasks (并发控制)
  // 使用 p-limit 或简单的按批次 Promise.all 并发请求 localChunks
  const localTasks = localChunks.map(chunk => withRetries(() => generateObject({
    system: localPrompt,
    messages: [{ role: "user", content: chunk }],
    schema: LocalSemanticResultSchema
  })));

  // 4. 等待所有大模型任务完成
  const [globalRes, ...localResults] = await Promise.all([globalTask, ...localTasks]);

  // 5. 聚合 (Reduce)
  const semanticIssues = [...globalRes.issues];
  localResults.forEach(res => semanticIssues.push(...res.issues));
  ```
- **依赖安装**：如果目前没有并发限制库，可使用简单的按批（chunkArray）并发控制，防止触发 OpenRouter 429 报错（参考 `trigger/review-orchestrator.ts` 中 `aitrace` 的并发设计，但由于这里在 `format.service.ts` 内部，建议直接用轻量级的分批 `Promise.all`）。

### 3.4 Orchestrator 传参适配
**文件**：`trigger/review-orchestrator.ts`
- 修改给 `format.service.ts` 传递 `ctx.formatReview.semantic` 的结构，确保把 Global 和 Local 的 Prompt 都正确传入。

## 4. 预期收益与验收标准
- **无漏检**：错别字、图表序号错误检出率大幅提升。
- **无幻觉**：单 Chunk 文本较短，`quote_text` 能 100% 精准匹配原文。
- **无误报**：Local Pass 不会因为“只看局部”而疯狂报错说结构缺失。
- **速度**：通过 `Promise.all` 并发，多章同时处理，格式审查耗时不仅不会增加，反而可能因为单次请求 Token 变短而加快 TTFB。
