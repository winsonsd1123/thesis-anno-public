/**
 * OpenRouter + Vercel AI SDK 集成层。
 *
 * 职责：API Key、模型实例工厂（模型 ID 由 config 的 model_config.model 传入，不硬编码）。
 * 不在此层处理 OpenRouter 429 / 配额与任务级重试——由 Trigger 编排与外层策略负责。
 * 若将来需要客户端侧「仅网络/5xx」重试，可通过 createOpenRouter({ fetch }) 注入，且勿对 429 自动重试以免与外层冲突。
 *
 * 调试：设置环境变量 OPENROUTER_LOG_PROMPTS=1 时，每次发往 OpenRouter 的 POST 会将**完整**请求体与响应体写入
 * `logs/openrouter/`（可用 OPENROUTER_LOG_DIR 覆盖目录）。控制台不再打印大段 body；格式审查阶段耗时与 token 摘要见
 * `analyzeFormat` 在相同开关下的单行输出。若仅需文件日志、不要格式摘要，可只开本开关而不改业务代码。
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";

function openRouterFileLogEnabled(): boolean {
  return process.env.OPENROUTER_LOG_PROMPTS?.trim() === "1";
}

/**
 * 将单次 OpenRouter 往返写入磁盘（请求 / 响应原文 + 耗时元数据）。失败时仅打一条 warn，不抛错。
 */
async function writeOpenRouterExchangeToFiles(
  requestRaw: string,
  responseRaw: string,
  meta: { durationMs: number; url: string }
): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir =
      process.env.OPENROUTER_LOG_DIR?.trim() ||
      path.join(process.cwd(), "logs", "openrouter");
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = `${stamp}-${Math.random().toString(36).slice(2, 10)}`;
    const base = path.join(dir, id);
    await fs.writeFile(`${base}-request.json`, requestRaw, "utf8");
    await fs.writeFile(`${base}-response.json`, responseRaw, "utf8");
    await fs.writeFile(`${base}-meta.json`, JSON.stringify(meta, null, 2), "utf8");
  } catch (e) {
    console.warn("[openrouter] failed to write log files:", e);
  }
}

/**
 * 包装 fetch：在 OPENROUTER_LOG_PROMPTS=1 且请求目标为 openrouter.ai 时，把完整请求/响应写入 logs/openrouter。
 */
function createOpenRouterLoggingFetch(
  baseFetch: typeof fetch
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input as RequestInfo, init);
    const url = request.url;

    if (!openRouterFileLogEnabled()) {
      return baseFetch(input, init);
    }

    if (!url.includes("openrouter.ai") || request.method !== "POST") {
      return baseFetch(input, init);
    }

    let requestRaw = "";
    try {
      requestRaw = await request.clone().text();
    } catch {
      requestRaw = "";
    }

    const t0 = performance.now();
    const response = await baseFetch(request);
    const durationMs = Math.round(performance.now() - t0);

    try {
      const responseRaw = await response.clone().text();
      await writeOpenRouterExchangeToFiles(requestRaw, responseRaw, {
        durationMs,
        url,
      });
    } catch (e) {
      console.warn("[openrouter] failed to capture/log response:", e);
    }

    return response;
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
