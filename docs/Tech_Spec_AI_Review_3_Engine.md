# AI 审阅引擎实施方案 3/3: 核心审阅模块 (Review Engines)

## 1. 模块定位
纯业务逻辑层（Services）。不关心状态管理和任务调度，只负责：组装 Prompt -> 携带上下文（Base64或文本）调用 LLM -> 解析和校验返回的 JSON 结果 -> 处理多源检索逻辑。

## 2. 目录结构与依赖

```text
/lib/services/
  ├── review/
  │   ├── format.service.ts
  │   ├── logic.service.ts
  │   └── reference.service.ts
  ├── search/
  │   ├── openalex.client.ts
  │   ├── crossref.client.ts
  │   └── aggregator.ts        # 并发检索与合并逻辑
  └── prompt.service.ts        # (已存在) 负责从配置读取 prompt
/config/
  └── prompts.default.json     # (已存在) 新增 format_review, logic_review, ref_extract 等 key
```

## 3. 核心实现细节

### 3.1 LLM 客户端封装 (OpenRouter)
需要一个统一的方法发起请求，并强制使用 `zod` 校验结构化输出 (`generateObject`)。因为使用 OpenRouter 转接，我们需要使用 `@openrouter/ai-sdk-provider`。

```typescript
import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// 初始化 OpenRouter 客户端
const openrouter = createOpenRouter({ 
  apiKey: process.env.OPENROUTER_API_KEY 
});

// 指定使用支持多模态的 Gemini 模型
const model = openrouter('google/gemini-3.1-pro-preview'); 
```

### 3.2 格式与逻辑服务 (`format.service.ts` / `logic.service.ts`)
模式类似，区别在于 Prompt 和 Zod Schema。
```typescript
// 以 logic.service.ts 为例
import { z } from 'zod';
import { getPrompt } from '../prompt.service';

const LogicResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(),
    issue_type: z.enum(['contradiction', 'weak_argument', 'unsupported_claim']),
    description: z.string(),
    suggestion: z.string()
  })),
  overall_score: z.number().min(0).max(100)
});

export async function analyzeLogic(content: string, contentType: 'base64' | 'text', context: any) {
  const promptTemplate = await getPrompt('logic_review');
  // 将 context (如 domain: CS) 注入到 promptTemplate 中
  const systemPrompt = promptTemplate.replace('{{domain}}', context.domain);
  
  // 根据 contentType 组装 message 数组 (Base64 需要 data URL 格式)
  const messages = buildMessages(content, contentType);

  const { object } = await generateObject({
    model,
    system: systemPrompt,
    messages,
    schema: LogicResultSchema,
  });
  return object;
}
```

### 3.3 参考文献多源核查服务 (`reference.service.ts`)
这是最复杂的模块，分为四步：

1.  **提取 (Extraction)**: 使用 `generateObject` 从 PDF 中提取出 `{ title, authors, rawText }` 的数组。
2.  **多源检索 (Parallel Search)**: `lib/services/search/aggregator.ts`
    ```typescript
    import pLimit from 'p-limit';
    const limit = pLimit(5); // 限制并发数为 5

    async function searchSources(title: string) {
       const [openAlexRes, crossRefRes] = await Promise.allSettled([
          limit(() => openAlexClient.search(title)),
          limit(() => crossRefClient.search(title))
       ]);
       // 择优逻辑：OpenAlex 优先，CrossRef 其次。返回最佳的 candidate。
       return selectBestCandidate(openAlexRes, crossRefRes);
    }
    ```
3.  **LLM 裁判 (Verification)**: 遍历每一条文献，把原文 `rawText` 和选出的 `candidate` 丢给一个小模型 (如 Gemini Flash) 判断。
    ```typescript
    const VerificationSchema = z.object({
      status: z.enum(['match', 'mismatch', 'not_found']),
      reason: z.string()
    });
    // 调用 generateObject 进行判定...
    ```
4.  **返回结果**: 组装带有状态和原因的最终 JSON 数组返回给 Trigger。

## 4. Prompt 配置要求
请在 `config/prompts.default.json` 中添加以下 keys：
*   `format_review_system`: 指导如何检查论文的结构完整性、GB/T 格式。
*   `logic_review_system`: 指导如何进行深度逻辑链审查，需要预留 `{{domain}}` 插值位。
*   `reference_extraction`: 指导如何仅提取参考文献列表。
*   `reference_verification`: (LLM 裁判) 给定原文和检索结果，指导如何输出匹配状态。