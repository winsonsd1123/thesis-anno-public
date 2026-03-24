/**
 * 本地校验 lib/clients/openrouter.client（不发起 OpenRouter 网络请求）。
 *
 * - 空 modelName
 * - 未配置 OPENROUTER_API_KEY
 * - 已配置 Key 时：模型实例具备 AI SDK 预期字段（specificationVersion / modelId）
 *
 * 用法：
 *   npx tsx scripts/verify-openrouter-client.ts
 *   OPENROUTER_API_KEY= npx tsx scripts/verify-openrouter-client.ts
 */

import assert from "node:assert/strict";
import { config } from "dotenv";
import type { LanguageModel } from "ai";
import { getLLMModel } from "../lib/clients/openrouter.client";

config({ path: ".env.local" });

function assertModelShape(m: LanguageModel) {
  assert.ok(typeof m === "object" && m !== null);
  assert.equal(
    (m as { specificationVersion?: string }).specificationVersion,
    "v3"
  );
  assert.ok(
    typeof (m as { modelId?: string }).modelId === "string" &&
      (m as { modelId: string }).modelId.length > 0
  );
}

// 1) 空 modelName（不依赖 Key）
assert.throws(() => getLLMModel(""), /non-empty/);
assert.throws(() => getLLMModel("   "), /non-empty/);

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  assert.throws(() => getLLMModel("google/gemini-2.0-flash-001"), /OPENROUTER_API_KEY/);
  console.log("verify-openrouter-client: OK (empty modelName + missing API key)");
  process.exit(0);
}

const model = getLLMModel("google/gemini-2.0-flash-001");
assertModelShape(model);
console.log("verify-openrouter-client: OK (empty modelName + model instance shape with API key)");
