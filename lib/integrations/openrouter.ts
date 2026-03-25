/**
 * OpenRouter + Vercel AI SDK 集成层。
 *
 * 职责：API Key、模型实例工厂（模型 ID 由 config 的 model_config.model 传入，不硬编码）。
 * 不在此层处理 OpenRouter 429 / 配额与任务级重试——由 Trigger 编排与外层策略负责。
 * 若将来需要客户端侧「仅网络/5xx」重试，可通过 createOpenRouter({ fetch }) 注入，且勿对 429 自动重试以免与外层冲突。
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";

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
