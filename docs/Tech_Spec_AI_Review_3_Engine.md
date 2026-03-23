# AI 审阅引擎实施方案 3/3: 核心审阅模块 (Review Engines)

## 1. 模块定位与架构解耦契约
纯业务逻辑层（Services）。该模块被设计为**无状态的计算管道 (Stateless Processing Pipeline)**，必须严格遵守以下解耦契约：
1. **不碰业务状态与数据库**：函数签名中绝不允许出现 `reviewId`。该模块完全不知道 Supabase 的存在，不执行任何写库操作。
2. **不处理并发与限流**：引擎层只提供“原子化”的处理函数（如核查*单条*参考文献）。全局的并发控制、OpenRouter 429 限流重试，统统交由外层的 Trigger.dev 调度器接管。
3. **抛出标准异常**：遇到 LLM 超时、并发错误或 JSON 解析失败时，抛出标准的自定义异常（如 `ReviewEngineError`），由外层捕获并决定是重试还是挂起。

## 2. 目录结构
明确区分业务服务（Services）与外部集成客户端（Clients，非内部数据库的 DAL）。

```text
/lib/
  ├── clients/                 # 外部服务集成层 (绝不叫 DAL)
  │   ├── openrouter.client.ts # 统一管理大模型调用、Token、超时
  │   ├── openalex.client.ts   # 学术 API
  │   └── crossref.client.ts   # 学术 API
  ├── services/
  │   ├── review/              # 纯无状态的核心审阅引擎
  │   │   ├── format.service.ts
  │   │   ├── logic.service.ts
  │   │   └── reference.service.ts
  │   └── search/
  │       └── aggregator.ts    # 聚合 OpenAlex 和 CrossRef 的检索逻辑
```

## 3. 核心实现细节

### 3.1 LLM 客户端封装 (`lib/clients/openrouter.client.ts`)
统一处理模型初始化、错误重试和 API Key 管理。为了适配 `config/prompts.default.json` 中的动态模型配置，我们不应硬编码模型名称，而是提供一个工厂函数。

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouter = createOpenRouter({ 
  apiKey: process.env.OPENROUTER_API_KEY 
});

/**
 * 根据 config 中的 model_config 动态创建模型实例
 * @param modelName 例如 'google/gemini-3.1-pro-preview'
 */
export function getLLMModel(modelName: string) {
  return openrouter(modelName);
}
```

### 3.2 逻辑审查服务 (`logic.service.ts`): Two-Pass 深度挖掘

**业务流程描述：**
1. **参数准备与模型初始化**：从外层传入的 `context` 中提取论文领域 (`domain`) 以及从配置中读取的 `model_config` (包含模型名称和温度)，并初始化对应的 LLM 实例。
2. **首轮逻辑审查 (Pass 1)**：组装基础的逻辑审查 Prompt，将 PDF 内容（Base64 或提取出的纯文本）喂给大模型，要求其找出显而易见的逻辑漏洞（如前后矛盾、论据不足），并强制要求返回符合 `LogicResultSchema` 的严格 JSON 数组。
3. **深度挖掘追问 (Pass 2 - 核心！)**：大模型在长文本审查时往往会“挤牙膏”，第一遍给出的结果通常不够深入。此时，我们将 Pass 1 生成的 JSON 结果转换为字符串，拼接上一个极其严厉的“追问 Prompt”（例如：“除了上述问题，还有没有其他隐藏漏洞？请继续深挖！”），连同原文再次喂给大模型，榨干其上下文理解能力。
4. **结果合并与返回**：返回最终深度挖掘后的 JSON 列表。

**核心代码骨架：**

```typescript
import { z } from 'zod';
import { generateObject } from 'ai';
import { getLLMModel } from '../clients/openrouter.client';

const LogicResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(),
    issue_type: z.enum(['contradiction', 'weak_argument', 'unsupported_claim']),
    description: z.string(),
    suggestion: z.string()
  }))
});

export async function analyzeLogic(
  content: string, 
  contentType: 'base64' | 'text', 
  context: { 
    domain: string, 
    modelConfig: { model: string, temperature: number },
    prompts: { pass1: string, pass2: string } 
  }
) {
  const model = getLLMModel(context.modelConfig.model);

  // Step 2: Pass 1 - 初步审查
  const { object: initialDraft } = await generateObject({
    model,
    temperature: context.modelConfig.temperature,
    system: context.prompts.pass1.replace('{{domain}}', context.domain),
    messages: buildMessages(content, contentType),
    schema: LogicResultSchema,
  });

  // Step 3: Pass 2 - 深度追问 (Discover More)
  const pass2Prompt = context.prompts.pass2.replace('{{initial_draft}}', JSON.stringify(initialDraft));
  const { object: finalResult } = await generateObject({
    model,
    temperature: context.modelConfig.temperature,
    system: pass2Prompt,
    messages: buildMessages(content, contentType), // 再次喂入原文
    schema: LogicResultSchema,
  });

  // Step 4: 返回结果
  return finalResult;
}
```

### 3.3 格式审查服务 (`format.service.ts`): 动态规则注入

**业务流程描述：**
1. **获取动态排版规范**：格式要求（如 GB/T 7714、或者特定学校的排版要求）具有很强的时效性和多变性。因此，这部分规则不应写死在代码或基础 Prompt 中，而是作为一段独立的 Markdown 文本（`formatGuidelines`），通过 `context` 动态传入。
2. **Prompt 组装与检查**：将这段动态规则注入到基础 Prompt 的占位符（`{{format_guidelines}}`）中，构建出一个完整的系统指令。然后调用大模型进行一次性的全量扫描。
3. **输出校验**：大模型根据注入的规则，输出不符合规范的段落和修改建议。

**核心代码骨架：**

```typescript
export async function analyzeFormat(
  content: string, 
  contentType: 'base64' | 'text', 
  context: { 
    formatGuidelines: string, // 动态注入的排版规则
    modelConfig: { model: string, temperature: number },
    promptTemplate: string
  } 
) {
  const model = getLLMModel(context.modelConfig.model);
  const systemPrompt = context.promptTemplate.replace('{{format_guidelines}}', context.formatGuidelines);
  
  const { object: formatResult } = await generateObject({
    model,
    temperature: context.modelConfig.temperature,
    system: systemPrompt,
    messages: buildMessages(content, contentType),
    schema: FormatResultSchema, // 定义了具体格式问题的 Zod Schema
  });
  
  return formatResult;
}
```

### 3.4 参考文献多源核查服务 (`reference.service.ts`): 批量化与原子拆分

为了极大提升效率、降低 Token 消耗，并解决 OpenRouter 的并发限流 (Rate Limit 429) 问题，引擎层被拆分为两个“原子方法”。其中核心的核查逻辑采用**“攒批 (Batching)”**模式，交由 Trigger 调度器去进行分布式调度。

**业务流程描述：**
1. **原子方法 1: 文献列表提取 (`extractReferencesFromPDF`)**：调用速度较快的大模型（如 Flash 模型），扫描整篇论文，剥离出文末的参考文献列表，提取为结构化的数组（包含：标题、作者、原文原始文本）。
2. **原子方法 2: 批量文献核查 (`verifyReferenceBatch`)**：接收**一批（例如 10 条）**文献作为输入。
   *   **并发外部检索 (API Clients)**：针对这 10 条文献，在 Node.js 内存中使用 `Promise.all` 并发调用外部学术 API。这里采用**瀑布流降级检索 (Sequential Fallback)**：优先请求最权威的 **CrossRef**，未命中则降级请求 **OpenAlex**，最后请求 **ArXiv**。
   *   **批量 LLM 裁判 (Batched LLM Call)**：收集到这 10 条文献的候选元数据 (Candidate) 后，将它们与原文打包成一个大的 JSON，**只发起一次大模型调用**。由大模型一次性返回这 10 条文献的比对结果（格式错误、造假等）。

**核心代码骨架：**

```typescript
import { searchCrossRef, searchOpenAlex, searchArxiv } from '../clients/academic';
import { z } from 'zod';

/**
 * 瀑布流降级检索策略
 */
async function searchSourcesWaterfall(title: string) {
  let candidate = await searchCrossRef(title);
  if (candidate) return candidate;

  candidate = await searchOpenAlex(title);
  if (candidate) return candidate;

  candidate = await searchArxiv(title);
  return candidate || null;
}

/**
 * 原子方法 1: 仅负责提取列表
 */
export async function extractReferencesFromPDF(
  content: string, 
  contentType: 'base64' | 'text', 
  context: { modelConfig: any, promptTemplate: string }
) {
  // 调用 generateObject 提取列表...
  return [
    { id: 1, title: "Attention is all you need", rawText: "[1] Vaswani A, et al. Attention..." },
    // ... 可能有 50 条
  ];
}

/**
 * 原子方法 2: 批量核查 (一次处理 N 条，减少 LLM 调用次数)
 * 并发与重试由外层 Trigger 接管。
 */
export async function verifyReferenceBatch(
  refsBatch: Array<{ id: number, title: string, rawText: string }>,
  context: { modelConfig: any, promptTemplate: string }
) {
  // a. 并发执行瀑布流多源检索 (仅查 API，不调 LLM)
  const candidates = await Promise.all(
    refsBatch.map(async (ref) => {
      const candidate = await searchSourcesWaterfall(ref.title);
      return { id: ref.id, rawText: ref.rawText, candidate };
    })
  );
  
  // b. 攒够一批后，发起唯一一次 LLM 裁判比对
  const BatchVerificationSchema = z.object({
    results: z.array(z.object({
      id: z.number(),
      status: z.enum(['match', 'mismatch', 'not_found']),
      reason: z.string()
    }))
  });

  const model = getLLMModel(context.modelConfig.model);
  const { object: verificationBatch } = await generateObject({
    model,
    system: context.promptTemplate,
    // 将 10 条原文和 10 个 candidate 一起喂进去
    messages: buildBatchVerificationMessages(candidates), 
    schema: BatchVerificationSchema
  });
  
  // 将 LLM 结果与原始输入合并返回
  return refsBatch.map(ref => {
    const v = verificationBatch.results.find(res => res.id === ref.id);
    return { ...ref, ...v };
  });
}
```

## 4. Prompt 配置要求
请在 `config/prompts.default.json` 中添加以下 keys：
*   `format_review_system`: 指导如何检查论文结构，预留 `{{format_guidelines}}` 插值位。
*   `logic_review_pass1`: 初审 Prompt，预留 `{{domain}}` 插值位。
*   `logic_review_pass2`: 追问 Prompt，预留 `{{initial_draft}}` 插值位。
*   `reference_extraction`: 指导如何仅提取参考文献列表。
*   `reference_verification`: (LLM 裁判) 给定原文和检索结果，指导如何输出匹配状态。