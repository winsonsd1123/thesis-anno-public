/**
 * 独立测试 format_physical_spec_extract LLM 调用
 * 用法: pnpm exec tsx scripts/test-physical-extract.ts [model]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { generateObject, generateText, zodSchema } from "ai";
import { getLLMModel } from "../lib/integrations/openrouter";
import { formatPhysicalExtractSchema } from "../lib/schemas/format-physical-extract.schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = process.argv[2] || "google/gemini-3-flash-preview";
const USE_TEXT = process.argv.includes("--text");
const TEMPERATURE = 0.1;

const systemPrompt = JSON.parse(
  readFileSync(join(__dirname, "../config/prompts.default.json"), "utf8")
).format_physical_spec_extract.templates.zh;

const guidelines = readFileSync(
  join(__dirname, "../config/format-guidelines.default.zh.md"),
  "utf8"
);

const userText = `以下为用户提供的论文格式要求（自然语言）。请仅依据文中**明确写出**的约束抽取结构化字段；禁止臆造未出现的规则。\n\n---\n${guidelines}`;

async function runStructured() {
  const model = getLLMModel(MODEL);
  const gen = await generateObject({
    model,
    temperature: TEMPERATURE,
    system: systemPrompt,
    messages: [{ role: "user", content: userText }],
    schema: zodSchema(formatPhysicalExtractSchema),
  });
  return { result: gen.object, usage: gen.usage };
}

async function runText() {
  const model = getLLMModel(MODEL);
  const gen = await generateText({
    model,
    temperature: TEMPERATURE,
    system: systemPrompt + "\n\n请以严格 JSON 格式输出，不要包含 markdown 代码块标记。",
    messages: [{ role: "user", content: userText }],
  });
  const jsonStr = gen.text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = formatPhysicalExtractSchema.parse(JSON.parse(jsonStr));
  return { result: parsed, usage: gen.usage, rawText: gen.text };
}

async function main() {
  console.log("=== 测试 format_physical_spec_extract ===");
  console.log(`模型: ${MODEL}`);
  console.log(`方式: ${USE_TEXT ? "generateText (无 schema 约束)" : "generateObject (structured output)"}`);
  console.log("---");

  const t0 = performance.now();
  try {
    const { result, usage } = USE_TEXT ? await runText() : await runStructured();
    const elapsed = Math.round(performance.now() - t0);
    console.log(`\n✅ 成功！耗时: ${elapsed}ms`);
    console.log("\n=== 抽取结果 ===");
    console.log(JSON.stringify(result, null, 2));
    console.log("\n=== Usage ===");
    console.log(JSON.stringify(usage, null, 2));
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - t0);
    console.error(`\n❌ 失败！耗时: ${elapsed}ms`);
    console.error("错误:", err?.message?.slice(0, 500));
  }
}

main();
