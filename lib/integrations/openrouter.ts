/**
 * OpenRouter + Vercel AI SDK 集成层。
 *
 * 职责：API Key、模型实例工厂（模型 ID 由 config 的 model_config.model 传入，不硬编码）。
 * 不在此层处理 OpenRouter 429 / 配额与任务级重试——由 Trigger 编排与外层策略负责。
 * 若将来需要客户端侧「仅网络/5xx」重试，可通过 createOpenRouter({ fetch }) 注入，且勿对 429 自动重试以免与外层冲突。
 *
 * 调试：设置环境变量 OPENROUTER_LOG_PROMPTS=1 时，每次发往 OpenRouter 的 POST 会在控制台打印
 * ISO 时间、model、以及 chat messages 中首条有效文本的「第一句话」（截断），便于对照任务执行顺序。
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";

const OPENROUTER_LOG_MAX_FIRST = 160;

function extractFirstSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const [first] = t.split(/[。！？.!?\r\n]/);
  const chunk = (first ?? t).trim();
  return chunk.slice(0, OPENROUTER_LOG_MAX_FIRST);
}

function messageContentToPlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("");
}

function firstPromptSentenceFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const text = messageContentToPlainText(
      (msg as { content?: unknown }).content
    );
    const first = extractFirstSentence(text);
    if (first) return first;
  }
  return "";
}

/**
 * 包装 fetch：在 OPENROUTER_LOG_PROMPTS=1 且请求目标为 openrouter.ai 时记录时间与提示首句。
 */
function createOpenRouterLoggingFetch(
  baseFetch: typeof fetch
): typeof fetch {
  return async (input, init) => {
    if (process.env.OPENROUTER_LOG_PROMPTS?.trim() !== "1") {
      return baseFetch(input, init);
    }

    const request = new Request(input as RequestInfo, init);
    const url = request.url;
    if (!url.includes("openrouter.ai") || request.method !== "POST") {
      return baseFetch(input, init);
    }

    try {
      const clone = request.clone();
      const raw = await clone.text();
      let body: unknown;
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = null;
      }
      const model =
        body && typeof body === "object" && "model" in body
          ? String((body as { model: unknown }).model)
          : "?";
      const firstSentence = firstPromptSentenceFromBody(body);
      const ts = new Date().toISOString();
      const preview = raw.slice(0, 2000);
      console.info(
        `[openrouter-request] ${ts} model=${model}\n${preview}`
      );
    } catch {
      console.info(
        `[openrouter-request] ${new Date().toISOString()} (log parse skipped)`
      );
    }

    return baseFetch(request);
  };
}

function buildOptionalHeaders(): Record<string, string> | undefined {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();

  const headers: Record<string, string> = {};
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;
  return Object.keys(headers).length > 0 ? headers : undefined;
}

let openRouterProvider: OpenRouterProvider | null = null;

/**
 * 懒加载单例，避免在未调用 LLM 时因缺少 Key 影响构建；
 * 首次调用时要求已配置 OPENROUTER_API_KEY。
 */
export function getOpenRouterProvider(): OpenRouterProvider {
  if (!openRouterProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to your environment (e.g. .env.local)."
      );
    }
    openRouterProvider = createOpenRouter({
      apiKey,
      compatibility: "strict",
      headers: buildOptionalHeaders(),
      fetch: createOpenRouterLoggingFetch(globalThis.fetch.bind(globalThis)),
    });
  }
  return openRouterProvider;
}

/**
 * 根据 config 中的 model_config.model 动态创建模型实例（OpenRouter 路由 ID，如 google/gemini-2.5-pro-preview）。
 * 可带 OpenRouter 后缀，例如 `openai/gpt-4o-mini:online` 以启用 Web Search 插件（OpenAI 等走厂商原生搜索，见 OpenRouter 文档）。
 */
export function getLLMModel(modelName: string): LanguageModel {
  const id = modelName.trim();
  if (!id) {
    throw new Error("getLLMModel: modelName must be a non-empty string");
  }
  return getOpenRouterProvider()(id);
}
