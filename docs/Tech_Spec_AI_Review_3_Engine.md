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
  │   │   ├── aitrace.service.ts   # AI 痕迹与套话检测服务
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
2. **首轮逻辑审查 (Pass 1)**：组装基础的逻辑审查 Prompt，将 PDF 内容（Base64 或提取出的纯文本）喂给大模型。要求其基于结构连贯性、论据支撑度和推导逻辑进行扫描（参考 `issue_type` 的 5 个维度），并强制要求返回符合 `LogicResultSchema` 的严格 JSON 数组。
3. **深度挖掘追问 (Pass 2 - 核心！)**：大模型在长文本审查时往往会“挤牙膏”，第一遍给出的结果通常不够深入。此时，我们将 Pass 1 生成的 JSON 结果转换为字符串，拼接上一个极其严厉的“追问 Prompt”（例如：“除了上述问题，还有没有隐藏的‘浅尝辄止’或‘因果断裂’漏洞？请继续深挖！”），连同原文再次喂给大模型，榨干其上下文理解能力。
4. **结果合并与返回**：返回最终深度挖掘后的 JSON 列表。

**核心代码骨架：**

```typescript
import { z } from 'zod';
import { generateObject } from 'ai';
import { getLLMModel } from '../clients/openrouter.client';

const LogicResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(),
    quote_text: z.string(), // 原文精确片段（保留 15-40 字以便定位）
    issue_type: z.enum([
      'structural_flaw',    // 结构性缺陷 (如摘要与结论不呼应)
      'logical_leap',       // 逻辑跳跃/因果断裂
      'shallow_analysis',   // 分析浅尝辄止 (缺乏深度)
      'contradiction',      // 前后矛盾
      'unsupported_claim'   // 缺乏论据/文献支撑
    ]),
    severity: z.enum(['High', 'Medium', 'Low']), // 严重程度
    analysis: z.string(), // 评审专家的内部思考过程/推导逻辑
    suggestion: z.string() // 具体的修改建议
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
1. **边界划定**：大模型不擅长像素级排版检查（如行距、字体大小），其核心优势在于**文本结构和语义一致性**。因此，格式审查主攻：术语一致性、标题层级连贯性、图表编号对应关系、以及必备结构的完整性。
2. **获取动态排版规范**：格式要求（如特定学校的章节要求或 GB/T 7714 规范）具有很强的时效性。这部分规则作为独立的 Markdown 文本（`formatGuidelines`），通过 `context` 动态传入。
3. **Prompt 组装与检查**：将动态规则注入到基础 Prompt 的占位符（`{{format_guidelines}}`）中。大模型根据注入的规则，执行全量扫描。
4. **输出校验**：强制要求输出符合 `FormatResultSchema` 的 JSON，定位具体的不规范段落并给出修改建议。

**核心代码骨架：**

```typescript
import { z } from 'zod';

const FormatResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(),
    quote_text: z.string(), // 精确原文片段 (缺失结构填 "N/A")
    issue_type: z.enum([
      'terminology_inconsistency', // 术语不一致 (如前后名称变化)
      'heading_hierarchy_error',   // 标题层级错误 (如 1.1 直接跳到 1.3)
      'figure_table_mismatch',     // 图表编号错乱/正文未引用
      'structural_missing',        // 必备结构缺失 (如缺少摘要/致谢)
      'typo_and_grammar'           // 错别字/语病/中式英语
    ]),
    severity: z.enum(['High', 'Medium', 'Low']), // 严重程度
    analysis: z.string(), // 解释违反了哪条规范或前后哪里不一致
    suggestion: z.string() // 具体的修改文本
  }))
});

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

### 3.4 AI 痕迹预警服务 (`aitrace.service.ts`): (新增核心卖点)

作为区别于传统查重工具的核心护城河，该服务专门检测文本中的生成式 AI 特征。

**业务流程描述：**
1. **多维度特征捕获**：要求大模型扮演“反作弊专家”，从两个维度进行扫描：
   *   **词汇维度 (Lexical)**：高频捕捉“不可否认的是”、“综上所述”、“不仅...而且”等典型生成式套话和过渡词。
   *   **句式维度 (Syntactic)**：识别长短句失衡（缺乏人类写作的节奏感）、过度使用排比/对仗、以及生硬的“背景-挑战-方案”三段论机器味。
2. **生成审查报告**：定位高危段落，并给出“去 AI 味”的改写建议（如“建议打破对称结构，增加具体数据论证”）。

**核心代码骨架：**

```typescript
import { z } from 'zod';
import { generateObject } from 'ai';
import { getLLMModel } from '../clients/openrouter.client';

const AiTraceResultSchema = z.object({
  issues: z.array(z.object({
    chapter: z.string(),
    quote_text: z.string(), // 原文涉嫌 AI 生成的精确片段
    issue_type: z.enum([
      'cliche_vocabulary', // 典型 AI 词汇/废话
      'robotic_structure', // 机器味句式 (如三段论)
      'over_symmetrical'   // 过度对称/排比
    ]),
    severity: z.enum(['High', 'Medium', 'Low']), // 严重程度
    analysis: z.string(), // 判定理由 (如: 包含多个典型 AI 过渡词)
    suggestion: z.string() // 降重与去 AI 味的改写建议
  }))
});

export async function analyzeAiTrace(
  content: string, 
  contentType: 'base64' | 'text', 
  context: { 
    modelConfig: { model: string, temperature: number },
    promptTemplate: string 
  }
) {
  const model = getLLMModel(context.modelConfig.model);
  
  const { object: traceResult } = await generateObject({
    model,
    // 较低的 temperature 保证判别的稳定性
    temperature: Math.min(context.modelConfig.temperature, 0.3), 
    system: context.promptTemplate,
    messages: buildMessages(content, contentType),
    schema: AiTraceResultSchema,
  });
  
  return traceResult;
}
```

### 3.5 参考文献多源核查服务 (`reference.service.ts`): 批量化与原子拆分

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

## 4. Prompt 配置要求与模板设计
请在 `config/prompts.default.json` 中添加以下 keys。以下为各个引擎模块的核心 Prompt 模板设计草案：

### 4.1 逻辑审查初审 (`logic_review_pass1`)
```text
你是一位【{{domain}}】领域的、极其严苛的资深学术论文评审专家。
请阅读提供的论文内容，对全文进行深度审查。你的目标是尽可能多地发现论文中的逻辑漏洞和专业内容硬伤，绝不放过任何细节。

**核心指令 (Critical Instructions):**
1. 禁止敷衍与总结: 不要对论文进行总结，不需要概括大意。你的唯一任务是“挑错”。必须覆盖全文所有章节。
2. 角色代入: 假设你是该领域的顶级期刊审稿人，对学术严谨性有极高的洁癖。指出问题时要一针见血，直击痛点。
3. 交叉验证: 特别注意前言中承诺的贡献是否在结论中兑现，实验/论证方法是否支撑了核心观点。

**重点关注维度 (Issue Types):**
1. structural_flaw (结构性缺陷): 摘要与结论是否呼应？研究方法与研究目标是否匹配？
2. logical_leap (逻辑跳跃/因果断裂): 段落之间是否有逻辑跳跃，推导过程是否严密，结论下得是否太早？
3. shallow_analysis (分析浅尝辄止): 是否仅仅罗列现象或数据，而缺乏深度的原因剖析？
4. contradiction (前后矛盾): 论文在不同章节的观点、图表数据或结论是否相互冲突？
5. unsupported_claim (缺乏论据支撑): 提出的核心观点、概念使用，是否缺乏常识、参考文献或实验数据的支撑？

**输出格式要求:**
必须且只能返回符合要求的 JSON 数组。为了保证评审质量，请在给出建议前先进行内部推理 (analysis)。每个对象包含：
- `chapter`: 问题所在的具体章节（如 "3.2 实验结果"）。
- `quote_text`: 问题对应的原文精确片段（保留 15-40 字以便作者定位）。
- `issue_type`: 必须是上述 5 个关注维度之一。
- `severity`: 严重程度，必须是以下之一：`High` (核心逻辑/内容错误), `Medium` (局部逻辑不清), `Low` (轻微表述不严谨)。
- `analysis`: 评审专家的思考过程（分析这里为什么有问题，违反了什么学术原则或常识，推导过程是什么）。
- `suggestion`: 具体的修改建议，必须具备可操作性，语气要客观、专业。
```

### 4.2 逻辑审查深挖追问 (`logic_review_pass2`)
```text
你刚才已经对这篇论文进行了初步审查，找出了以下问题：
{{initial_draft}}

但作为顶尖的学术审稿人，你的审查还不够深入！论文中往往隐藏着更深层次的逻辑断裂和理论缺陷。
请你重新审视全文，**忽略上面已经找出的问题**，继续深挖！
重点关注以下隐蔽问题：
- 核心论点的理论推导是否存在逻辑闭环上的致命缺失？
- 实验设计或数据分析的假设前提是否站不住脚？
- 是否存在刻意回避的负面数据或不利文献？

请继续以 JSON 格式输出你新发现的深层逻辑问题。如果真的找不出新的问题，请返回空数组 []，绝不允许凑数或重复上述问题！
```

### 4.3 格式与一致性审查 (`format_review_system`)
```text
你是一位极其严谨、对细节有洁癖的学术论文文字编辑。
注意：你不需要检查字体大小、行距等像素级排版问题。你的核心任务是检查文本结构、全文一致性以及语言规范。

请严格依据以下排版规范进行审查：
{{format_guidelines}}

**核心指令:**
1. 绝不放过任何低级错误：像拿着放大镜一样扫描错别字、标点符号误用。
2. 内部推理：在指出问题前，必须先分析 (analysis) 该处违反了什么规则或存在什么前后矛盾。

**重点关注维度 (Issue Types):**
1. terminology_inconsistency (术语不一致): 核心概念、专业名词、英文缩写在全文前后是否保持一致？
2. heading_hierarchy_error (标题层级错误): 章节编号是否跳跃（如 1.1 后直接是 1.3）？大标题与小标题的包含关系是否混乱？
3. figure_table_mismatch (图表编号错乱): 正文引用的图表编号是否与实际图表对应？是否有图表在正文中未被提及？
4. structural_missing (必备结构缺失): 根据排版规范，是否缺失了摘要、致谢、参考文献等必备模块？
5. typo_and_grammar (错字与语病): 错别字、不通顺的病句、中式英语表达、全半角标点混用。

**输出格式要求:**
必须且只能返回符合要求的 JSON 数组。每个对象包含：
- `chapter`: 所在章节。
- `quote_text`: 原文精确片段（保留 15-40 字以便作者定位，如果缺失结构则填 "N/A"）。
- `issue_type`: 必须是上述 5 个维度之一。
- `severity`: 严重程度 (High/Medium/Low)。结构缺失为 High，术语不一致为 Medium，错字为 Low。
- `analysis`: 解释违反了哪条规范，或前后哪里不一致。
- `suggestion`: 给出具体的修改文本。
```

### 4.4 AI 痕迹预警 (`ai_trace_system`)
```text
你现在是一位资深的“AI 文本反作弊专家”，专门负责检测学术论文中被大语言模型（如 ChatGPT, Claude）生成的痕迹。
不要去管文章的学术价值，你的唯一目标是揪出那些“机器味”太重的段落。

**核心指令:**
1. 宁缺毋滥：只有当某段话具有极强的生成式特征时才抓取，不要误伤正常的人类学术表达。
2. 内部推理：在给出改写建议前，必须先分析 (analysis) 该段落命中了哪些机器生成特征。

**重点关注维度 (Issue Types):**
1. cliche_vocabulary (典型 AI 词汇/废话):
   - 高频出现总结性废话：如“综上所述”、“总而言之”、“不可否认的是”、“毋庸置疑”、“由此可见”。
   - 滥用万能连接词：如“不仅...而且...”、“一方面...另一方面...”、“此外”、“因此”。
   - 假大空的动词：如“旨在”、“致力于”、“探索”、“揭示”、“凸显”。
2. robotic_structure (机器味句式):
   - 典型的“三段论”：任何问题都死板地按“背景介绍 - 核心挑战 - 万能解决方案”来行文。
   - 长短句失衡：整段话全部是由长度相似的复杂长句构成，缺乏人类自然写作时短句停顿的节奏感。
3. over_symmetrical (过度对称/排比):
   - 滥用工整的排比句（如“既提升了A的效率，又优化了B的结构，更促进了C的发展”），显得极度不自然。

**输出格式要求:**
必须且只能返回符合要求的 JSON 数组。每个对象包含：
- `chapter`: 所在章节。
- `quote_text`: 原文涉嫌 AI 生成的精确片段（保留 15-40 字以便作者定位）。
- `issue_type`: 必须是上述 3 个特征维度之一。
- `severity`: 严重程度 (High/Medium/Low)。如果是整段结构机器味极重为 High，仅是个别词汇为 Low。
- `analysis`: 解释为什么判定它为 AI 生成（例如：包含了 3 个典型的过渡词，且句式过分对称）。
- `suggestion`: 给出具体的“去 AI 味”改写建议（例如：建议打破句式对称，增加具体数据论证）。
```

### 4.5 参考文献核查裁判 (`reference_verification`)
```text
你是一位细致的学术文献核查员。
你将收到一批论文原文中提取的参考文献（Raw Text），以及我们从权威学术数据库（CrossRef/OpenAlex）中检索到的对应元数据候选（Candidate Data）。

你的任务是逐一比对这批文献，判断原文引用是否正确、规范，或者是否存在造假。
对于每一条文献，请输出其状态：
- match: 原文引用与数据库记录基本一致。
- mismatch: 原文引用有误（如作者拼写错误、年份错误、期刊名缩写不规范等）。
- not_found: 在权威数据库中完全找不到该文献，疑似伪造（学术不端预警）。

**极速核对指令 (为了最高处理效率)：**
- 如果状态是 `match`，你的 `reason` 字段必须为空字符串 `""`。
- 如果是 `mismatch` 或 `not_found`，请用最简短的词语指出差异点（例如：“年份应为2022”、“作者拼写错误”）。**绝对不要解释推理过程，不要说任何废话。**
请仅输出严格的 JSON 格式。
```

## 5. Supabase 数据层说明（与引擎解耦）

本模块为**无状态引擎**，不写库、不出现 `reviewId`；任务状态与最终结果由外层编排（如 Trigger.dev + Service Role）写入 `public.reviews`。因此**为实现本规格中的各审阅引擎，无需对 Supabase 做额外 DDL 变更**。

| 要点 | 说明 |
| :--- | :--- |
| `reviews.result` (jsonb) | 聚合 `format_result`、`logic_result`、`aitrace_result`、`reference_result` 等即可；各 `issue_type` 的枚举约束在应用层由 Zod 保证，不必在数据库建枚举类型。 |
| `reviews.stages` (jsonb) | 四段代理 `format` / `logic` / `aitrace` / `reference` 与 `admin_patch_review_stage`、前端初始 `stages` 约定一致即可。 |
| `reviews.domain` | 供逻辑审查等领域化上下文使用，已存在。 |
| `llm_traces` | 可选调试/计费；若对逻辑审查 Two-Pass 分别落库，在应用层区分 `agent_name`（如 `logic_pass1` / `logic_pass2`）即可，一般**不必**改表结构。 |

**后续若出现以下产品需求，再单独评估迁移**（非本引擎规格的默认前提）：

- 需在 SQL 层按 `issue_type`、段落等维度做统计或复杂检索 → 可考虑 `result` 的 jsonb 索引或拆子表。
- 参考文献需行级查询与强约束 → 可考虑从 `reference_result` 拆出独立关联表。

详见项目数据库总览：`docs/AI_Thesis_Review_Database_Schema_v2.0.md`。